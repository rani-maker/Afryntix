"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { computeInsurance } from "@/lib/insurance";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

export async function getActiveInsuranceSetting() {
  const row = await prisma.insuranceSetting.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  return (
    row ?? {
      id: null,
      ratePercent: 1.5,
      minPremiumXOF: 2000,
      maxCoverageXOF: 5_000_000,
      notes: null,
    }
  );
}

const SettingSchema = z.object({
  ratePercent: z.coerce.number().min(0).max(100),
  minPremiumXOF: z.coerce.number().nonnegative(),
  maxCoverageXOF: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export async function updateInsuranceSetting(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = SettingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  await prisma.insuranceSetting.updateMany({ where: { active: true }, data: { active: false } });
  await prisma.insuranceSetting.create({
    data: {
      ratePercent: parsed.data.ratePercent,
      minPremiumXOF: parsed.data.minPremiumXOF,
      maxCoverageXOF: parsed.data.maxCoverageXOF,
      notes: parsed.data.notes,
      active: true,
    },
  });
  revalidatePath("/admin/insurance");
  return { success: true };
}

const ApplySchema = z.object({
  shipmentId: z.string().min(1),
  optedIn: z.coerce.boolean(),
  declaredValue: z.coerce.number().nonnegative().optional(),
});

/**
 * Souscrit (ou résilie) l'assurance sur un colis.
 * Recalcule totalAmount, remainingAmount et le statut paiement.
 */
export async function applyInsurance(input: unknown): Promise<Result<{ premium: number; coverage: number }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = ApplySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.data.shipmentId },
    include: { facture: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };

  const setting = await getActiveInsuranceSetting();

  const oldPremium = shipment.insurancePremium ?? 0;

  let newPremium = 0;
  let newCoverage = 0;
  let declaredValue: number | null = null;

  if (parsed.data.optedIn) {
    declaredValue = parsed.data.declaredValue ?? 0;
    if (declaredValue <= 0) return { success: false, error: "Indiquez une valeur déclarée > 0." };
    const quote = computeInsurance({
      declaredValue,
      ratePercent: setting.ratePercent,
      minPremiumXOF: setting.minPremiumXOF,
      maxCoverageXOF: setting.maxCoverageXOF,
    });
    newPremium = quote.premium;
    newCoverage = quote.coverage;
  }

  const delta = newPremium - oldPremium;
  const newTotal = shipment.totalAmount + delta;
  const newRemaining = Math.max(0, newTotal - shipment.amountPaid);
  let paymentStatus: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = "UNPAID";
  if (shipment.amountPaid >= newTotal) paymentStatus = "FULLY_PAID";
  else if (shipment.amountPaid >= shipment.depositAmount) paymentStatus = "DEPOSIT_PAID";

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      insuranceOptedIn: parsed.data.optedIn,
      declaredValue,
      insurancePremium: parsed.data.optedIn ? newPremium : null,
      insuranceMaxCoverage: parsed.data.optedIn ? newCoverage : null,
      totalAmount: newTotal,
      remainingAmount: newRemaining,
      paymentStatus,
      history: {
        create: {
          status: shipment.status,
          note: parsed.data.optedIn
            ? `Assurance souscrite — valeur ${declaredValue?.toLocaleString("fr-FR")} FCFA, prime ${newPremium.toLocaleString("fr-FR")} FCFA, couverture ${newCoverage.toLocaleString("fr-FR")} FCFA`
            : `Assurance résiliée (prime ${oldPremium.toLocaleString("fr-FR")} FCFA retirée)`,
          createdBy: session.user.id,
        },
      },
    },
  });

  // Recalcul facture liée
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

  return { success: true, data: { premium: newPremium, coverage: newCoverage } };
}
