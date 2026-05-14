"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

/**
 * Recherche rapide d'un colis pour le mode entrepôt mobile.
 * Accepte le numéro de suivi exact (insensible à la casse).
 */
export async function lookupShipmentForWarehouse(trackingNumber: string): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const tn = trackingNumber.trim().toUpperCase();
  if (!tn) return { success: false, error: "Numéro de suivi requis." };

  const s = await prisma.shipment.findFirst({
    where: { trackingNumber: tn },
    include: { client: { select: { name: true } } },
  });
  if (!s) return { success: false, error: `Aucun colis ${tn}.` };

  return {
    success: true,
    data: {
      id: s.id,
      trackingNumber: s.trackingNumber,
      status: s.status,
      declaredWeightKg: s.declaredWeightKg,
      verifiedWeightKg: s.verifiedWeightKg,
      weightKg: s.weightKg,
      totalAmount: s.totalAmount,
      description: s.description,
      clientLabel: s.client?.name ?? s.clientName ?? "—",
    },
  };
}
