"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { generateReference } from "@/lib/utils";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

export async function recordFacturePayment(input: {
  factureId: string;
  amount: number;
}): Promise<Result> {
  await requireRole("STAFF", "ADMIN");

  const facture = await prisma.facture.findUnique({
    where: { id: input.factureId },
    include: { shipments: true },
  });
  if (!facture) return { success: false, error: "Facture introuvable." };
  if (input.amount <= 0) return { success: false, error: "Montant invalide." };

  const newPaid = facture.amountPaid + input.amount;
  const remaining = Math.max(0, facture.totalAmount - newPaid);
  let status = facture.status;
  if (newPaid >= facture.totalAmount) status = "FULLY_PAID";
  else if (newPaid >= facture.depositAmount) status = "DEPOSIT_PAID";

  await prisma.$transaction(async (tx) => {
    await tx.facture.update({
      where: { id: input.factureId },
      data: { amountPaid: newPaid, remainingAmount: remaining, status },
    });

    // Distribuer le paiement sur les colis proportionnellement
    const total = facture.totalAmount;
    for (const shipment of facture.shipments) {
      const share = total > 0 ? (shipment.totalAmount / total) * input.amount : 0;
      const shipNewPaid = shipment.amountPaid + share;
      let shipStatus = shipment.paymentStatus;
      if (shipNewPaid >= shipment.totalAmount) shipStatus = "FULLY_PAID";
      else if (shipNewPaid >= shipment.depositAmount) shipStatus = "DEPOSIT_PAID";
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { amountPaid: shipNewPaid, paymentStatus: shipStatus },
      });
    }
  });

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  revalidatePath("/staff/payments");
  return { success: true };
}

export async function getOrCreateFactureForShipments(input: {
  shipmentIds: string[];
  shippingMarkId?: string;
  clientId?: string;
  envoiId?: string;
}): Promise<{ id: string; reference: string }> {
  // Si tous les shipments ont déjà la même facture, on la retourne
  const shipments = await prisma.shipment.findMany({
    where: { id: { in: input.shipmentIds } },
    select: { id: true, totalAmount: true, depositAmount: true, remainingAmount: true, factureId: true },
  });

  const existingFactureIds = [...new Set(shipments.map((s) => s.factureId).filter(Boolean))] as string[];
  if (existingFactureIds.length === 1) {
    const existing = await prisma.facture.findUnique({ where: { id: existingFactureIds[0] } });
    if (existing) {
      // Recalculer les totaux (des colis peuvent avoir été ajoutés)
      const total = shipments.reduce((sum, s) => sum + s.totalAmount, 0);
      const deposit = total * 0.5;
      const remaining = Math.max(0, total - existing.amountPaid);
      await prisma.facture.update({
        where: { id: existing.id },
        data: { totalAmount: total, depositAmount: deposit, remainingAmount: remaining },
      });
      return { id: existing.id, reference: existing.reference };
    }
  }

  // Créer une nouvelle facture
  let reference = generateReference("FAC");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.facture.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateReference("FAC");
  }

  const total = shipments.reduce((sum, s) => sum + s.totalAmount, 0);
  const deposit = total * 0.5;

  const facture = await prisma.facture.create({
    data: {
      reference,
      shippingMarkId: input.shippingMarkId ?? null,
      clientId: input.clientId ?? null,
      envoiId: input.envoiId ?? null,
      totalAmount: total,
      depositAmount: deposit,
      amountPaid: 0,
      remainingAmount: total,
      status: "UNPAID",
    },
  });

  // Lier les colis à cette facture
  await prisma.shipment.updateMany({
    where: { id: { in: input.shipmentIds } },
    data: { factureId: facture.id },
  });

  return { id: facture.id, reference: facture.reference };
}

/**
 * Crée (ou remplace) une facture forfaitaire pour un envoi FCL.
 *
 * Cas d'usage : un client réserve un conteneur 40HQ entier. Les colis qui
 * arrivent à l'entrepôt sont enregistrés un par un (pour traçabilité,
 * manifeste, pesée), mais le client paie un **prix forfaitaire global**
 * négocié pour le conteneur — pas un prix par colis.
 *
 * Comportement :
 *  - n'accepte que les envois `SEA_FCL`
 *  - le forfait est réparti proportionnellement par CBM si tous les
 *    colis ont un CBM > 0, sinon répartition à parts égales
 *  - réécrit `unitPrice` / `totalAmount` / `depositAmount` (50%) /
 *    `remainingAmount` de chaque colis pour refléter sa quote-part
 *  - si une facture est déjà liée à cet envoi, on la met à jour
 *    (équivalent d'une renégociation du forfait)
 */
const FclFlatRateSchema = z.object({
  envoiId: z.string().min(1),
  flatRateXof: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export async function createFclFlatRateInvoice(
  input: unknown,
): Promise<Result<{ factureId: string; reference: string }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = FclFlatRateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const data = parsed.data;

  const envoi = await prisma.envoi.findUnique({
    where: { id: data.envoiId },
    include: {
      shipments: {
        select: { id: true, totalAmount: true, amountPaid: true, depositAmount: true, volumeCBM: true, clientId: true },
      },
    },
  });
  if (!envoi) return { success: false, error: "Envoi introuvable." };
  if (envoi.mode !== "SEA_FCL") {
    return { success: false, error: "La facturation forfaitaire n'est disponible que pour les envois Conteneur complet (FCL)." };
  }
  if (envoi.shipments.length === 0) {
    return { success: false, error: "Aucun colis rattaché à cet envoi." };
  }

  // Client de la facture = client commun s'il est unique (sinon null, facture liée à l'envoi)
  const clientIds = [...new Set(envoi.shipments.map((s) => s.clientId).filter(Boolean))] as string[];
  const commonClientId = clientIds.length === 1 ? clientIds[0] : null;

  // Répartition : par CBM si tous > 0, sinon à parts égales
  const totalCbm = envoi.shipments.reduce((sum, s) => sum + (s.volumeCBM ?? 0), 0);
  const useCbm = totalCbm > 0 && envoi.shipments.every((s) => (s.volumeCBM ?? 0) > 0);
  const n = envoi.shipments.length;

  // Calcul des quote-parts avec correction d'arrondi sur le dernier colis
  const shares: { id: string; share: number }[] = [];
  let allocated = 0;
  envoi.shipments.forEach((s, idx) => {
    let share: number;
    if (idx === n - 1) {
      share = data.flatRateXof - allocated;
    } else {
      const ratio = useCbm ? (s.volumeCBM ?? 0) / totalCbm : 1 / n;
      share = Math.round(data.flatRateXof * ratio);
      allocated += share;
    }
    shares.push({ id: s.id, share });
  });

  // Facture existante liée à cet envoi ?
  const existing = await prisma.facture.findFirst({ where: { envoiId: envoi.id } });

  const result = await prisma.$transaction(async (tx) => {
    let factureId: string;
    let reference: string;

    if (existing) {
      factureId = existing.id;
      reference = existing.reference;
      const remaining = Math.max(0, data.flatRateXof - existing.amountPaid);
      let status: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = "UNPAID";
      const deposit = Math.round(data.flatRateXof * 0.5);
      if (existing.amountPaid >= data.flatRateXof) status = "FULLY_PAID";
      else if (existing.amountPaid >= deposit) status = "DEPOSIT_PAID";
      await tx.facture.update({
        where: { id: factureId },
        data: {
          totalAmount: data.flatRateXof,
          depositAmount: deposit,
          remainingAmount: remaining,
          status,
          clientId: commonClientId,
          notes: data.notes ?? existing.notes,
        },
      });
    } else {
      reference = generateReference("FAC");
      for (let i = 0; i < 5; i++) {
        const exists = await tx.facture.findUnique({ where: { reference } });
        if (!exists) break;
        reference = generateReference("FAC");
      }
      const deposit = Math.round(data.flatRateXof * 0.5);
      const created = await tx.facture.create({
        data: {
          reference,
          envoiId: envoi.id,
          clientId: commonClientId,
          totalAmount: data.flatRateXof,
          depositAmount: deposit,
          amountPaid: 0,
          remainingAmount: data.flatRateXof,
          status: "UNPAID",
          notes: data.notes ?? `Forfait conteneur FCL · envoi ${envoi.reference}`,
        },
      });
      factureId = created.id;
    }

    // Mise à jour de chaque colis avec sa quote-part
    for (const { id, share } of shares) {
      const ship = envoi.shipments.find((s) => s.id === id)!;
      const depositPart = Math.round(share * 0.5);
      const remainingPart = Math.max(0, share - ship.amountPaid);
      let payStatus: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = "UNPAID";
      if (ship.amountPaid >= share) payStatus = "FULLY_PAID";
      else if (ship.amountPaid >= depositPart) payStatus = "DEPOSIT_PAID";

      await tx.shipment.update({
        where: { id },
        data: {
          unitPrice: share, // forfait = la quote-part totale du colis
          totalAmount: share,
          depositAmount: depositPart,
          remainingAmount: remainingPart,
          paymentStatus: payStatus,
          factureId,
          history: {
            create: {
              status: "REGISTERED", // pas de changement de statut logistique
              note: `Facturation forfaitaire FCL : quote-part ${share.toLocaleString("fr-FR")} FCFA sur forfait ${data.flatRateXof.toLocaleString("fr-FR")} FCFA (${useCbm ? "réparti au CBM" : "réparti à parts égales"}).`,
            },
          },
        },
      });
    }

    return { factureId, reference };
  });

  revalidatePath(`/staff/envois/${envoi.id}`);
  revalidatePath(`/admin/envois/${envoi.id}`);
  revalidatePath("/staff/payments");
  revalidatePath("/admin/factures");

  return { success: true, data: result };
}
