"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/auth";
import { computeStorageFee } from "@/lib/storage-fees";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

/**
 * Sécurité : tout export d'un fichier `"use server"` est une Server Action
 * publiquement appelable. On exige une session authentifiée pour empêcher
 * un attaquant anonyme de lire la configuration tarifaire.
 */
export async function getActiveStorageSetting() {
  await requireAuth();
  const row = await prisma.storageSetting.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  return row ?? { freeDays: 7, dailyRateXOF: 1000, notes: null, id: null };
}

const UpdateSchema = z.object({
  freeDays: z.coerce.number().int().min(0).max(365),
  dailyRateXOF: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export async function updateStorageSetting(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  // Transaction : désactivation + création atomiques
  // (sinon, si le create échoue, on se retrouve sans réglage actif).
  await prisma.$transaction([
    prisma.storageSetting.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.storageSetting.create({
      data: {
        freeDays: parsed.data.freeDays,
        dailyRateXOF: parsed.data.dailyRateXOF,
        notes: parsed.data.notes,
        active: true,
      },
    }),
  ]);

  revalidatePath("/admin/storage");
  return { success: true };
}

const ChargeSchema = z.object({
  shipmentId: z.string().min(1),
  asOf: z.string().optional(),
  overrideDays: z.coerce.number().int().min(0).optional(),
});

/**
 * Calcule les frais d'entreposage du colis et les ajoute à son total + facture liée.
 * Idempotent : si déjà facturé, retourne erreur (sauf si overrideDays donné, on remplace).
 */
export async function chargeStorageFees(input: unknown): Promise<Result<{ amount: number; days: number }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = ChargeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.data.shipmentId },
    include: { facture: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (!shipment.availableSinceAt) {
    return { success: false, error: "Le colis n'a pas encore été mis à disposition (AVAILABLE_FOR_DELIVERY)." };
  }
  if (shipment.storageChargedAt && parsed.data.overrideDays == null) {
    return { success: false, error: "Frais déjà facturés. Repasser avec overrideDays pour ajuster." };
  }

  const setting = await getActiveStorageSetting();
  const asOf = parsed.data.asOf ? new Date(parsed.data.asOf) : new Date();
  const quote = computeStorageFee({
    availableSinceAt: shipment.availableSinceAt,
    asOf,
    freeDays: setting.freeDays,
    dailyRateXOF: setting.dailyRateXOF,
  });

  const billableDays = parsed.data.overrideDays ?? quote.billableDays;
  const amount = Math.round(billableDays * setting.dailyRateXOF);

  // Réversion d'un ancien charge si on ré-applique
  const oldFee = shipment.storageFeeAmount ?? 0;
  const delta = amount - oldFee;

  const newTotal = shipment.totalAmount + delta;
  const newRemaining = Math.max(0, newTotal - shipment.amountPaid);
  let paymentStatus: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = shipment.paymentStatus;
  if (shipment.amountPaid >= newTotal) paymentStatus = "FULLY_PAID";
  else if (shipment.amountPaid >= shipment.depositAmount) paymentStatus = "DEPOSIT_PAID";
  else paymentStatus = "UNPAID";

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      totalAmount: newTotal,
      remainingAmount: newRemaining,
      paymentStatus,
      storageDaysCharged: billableDays,
      storageFeeAmount: amount,
      storageChargedAt: new Date(),
      history: {
        create: {
          status: shipment.status,
          note:
            `Frais d'entreposage facturés : ${billableDays} jour${billableDays > 1 ? "s" : ""} × ${setting.dailyRateXOF.toLocaleString("fr-FR")} FCFA = ${amount.toLocaleString("fr-FR")} FCFA` +
            (oldFee > 0 ? ` (ajustement de ${oldFee.toLocaleString("fr-FR")} FCFA)` : ""),
          createdBy: session.user.id,
        },
      },
    },
  });

  // Mettre à jour la facture liée
  if (shipment.factureId) {
    const allShipments = await prisma.shipment.findMany({
      where: { factureId: shipment.factureId },
      select: { totalAmount: true, amountPaid: true, depositAmount: true },
    });
    const factTotal = allShipments.reduce((s, x) => s + x.totalAmount, 0);
    const factPaid = allShipments.reduce((s, x) => s + x.amountPaid, 0);
    const factDeposit = allShipments.reduce((s, x) => s + x.depositAmount, 0);
    const factRemaining = Math.max(0, factTotal - factPaid);
    let factStatus: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = "UNPAID";
    if (factPaid >= factTotal) factStatus = "FULLY_PAID";
    else if (factPaid >= factDeposit) factStatus = "DEPOSIT_PAID";
    await prisma.facture.update({
      where: { id: shipment.factureId },
      data: { totalAmount: factTotal, amountPaid: factPaid, remainingAmount: factRemaining, status: factStatus },
    });
  }

  revalidatePath(`/staff/shipments/${shipment.id}`);
  revalidatePath(`/admin/shipments/${shipment.id}`);

  return { success: true, data: { amount, days: billableDays } };
}
