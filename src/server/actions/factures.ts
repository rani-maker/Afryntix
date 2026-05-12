"use server";
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
