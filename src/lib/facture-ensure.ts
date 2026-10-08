import type { Prisma } from "@prisma/client";
import { generateReference } from "./utils";

export type EnsureFactureResult =
  | { ok: true; factureId: string; reference: string; created: boolean; linked: number }
  | { ok: false; error: string };

/**
 * Retourne la facture d'un shipping mark pour un voyage donné, en la créant si besoin.
 *
 * Une facture = les colis du même shipping mark dans le même envoi. Si ces colis sont
 * déjà couverts par une facture (ex. générée à la mise à disposition, ou forfait FCL),
 * elle est réutilisée ; les colis du mark pas encore facturés lui sont rattachés.
 * Les montants de la facture sont resynchronisés sur ceux des colis.
 *
 * À appeler dans une transaction : création, rattachement et recalcul vont ensemble.
 */
export async function ensureFactureForMark(
  db: Prisma.TransactionClient,
  input: { envoiId: string; markId: string },
): Promise<EnsureFactureResult> {
  const shipments = await db.shipment.findMany({
    where: { envoiId: input.envoiId, shippingMarkId: input.markId, status: { not: "CANCELLED" } },
    select: { id: true, clientId: true, factureId: true, totalAmount: true },
  });
  if (shipments.length === 0) return { ok: false, error: "Aucun colis de ce shipping mark dans cet envoi." };
  if (shipments.reduce((sum, s) => sum + s.totalAmount, 0) <= 0) {
    return {
      ok: false,
      error: "Ces colis sont à 0 FCFA : renseignez d'abord leur prix (ou le forfait conteneur pour un FCL).",
    };
  }

  const linkedIds = [...new Set(shipments.map((s) => s.factureId).filter((v): v is string => !!v))];
  const unlinked = shipments.filter((s) => !s.factureId).map((s) => s.id);
  const pick = { id: true, reference: true, status: true } as const;

  // 1. Facture déjà dédiée à ce couple voyage + shipping mark
  let facture = await db.facture.findFirst({
    where: { envoiId: input.envoiId, shippingMarkId: input.markId },
    orderBy: { createdAt: "asc" },
    select: pick,
  });
  // 2. Sinon, la facture qui couvre déjà ces colis (celle qui en couvre le plus)
  if (!facture && linkedIds.length > 0 && (unlinked.length === 0 || linkedIds.length === 1)) {
    const counts = new Map<string, number>();
    for (const s of shipments) if (s.factureId) counts.set(s.factureId, (counts.get(s.factureId) ?? 0) + 1);
    const bestId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    facture = await db.facture.findUnique({ where: { id: bestId }, select: pick });
  }
  // 3. Sinon, nouvelle facture
  let created = false;
  if (!facture) {
    let reference = generateReference("FAC");
    for (let i = 0; i < 5; i++) {
      const exists = await db.facture.findUnique({ where: { reference } });
      if (!exists) break;
      reference = generateReference("FAC");
    }
    const clientIds = [...new Set(shipments.map((s) => s.clientId).filter((v): v is string => !!v))];
    facture = await db.facture.create({
      data: {
        reference,
        envoiId: input.envoiId,
        shippingMarkId: input.markId,
        clientId: clientIds.length === 1 ? clientIds[0] : null,
        totalAmount: 0,
        depositAmount: 0,
        remainingAmount: 0,
      },
      select: pick,
    });
    created = true;
  }

  if (unlinked.length > 0) {
    await db.shipment.updateMany({ where: { id: { in: unlinked } }, data: { factureId: facture.id } });
  }

  // Resynchronise les montants de la facture sur ses colis (source de vérité)
  const covered = await db.shipment.findMany({
    where: { factureId: facture.id, status: { not: "CANCELLED" } },
    select: { totalAmount: true, amountPaid: true },
  });
  const total = covered.reduce((sum, s) => sum + s.totalAmount, 0);
  const paid = Math.min(total, covered.reduce((sum, s) => sum + s.amountPaid, 0));
  const deposit = Math.round(total * 0.5);
  await db.facture.update({
    where: { id: facture.id },
    data: {
      totalAmount: total,
      depositAmount: deposit,
      amountPaid: paid,
      remainingAmount: Math.max(0, total - paid),
      // Un remboursement est une décision manuelle : on ne l'écrase pas.
      ...(facture.status === "REFUNDED"
        ? {}
        : { status: total > 0 && paid >= total ? "FULLY_PAID" : paid > 0 && paid >= deposit ? "DEPOSIT_PAID" : "UNPAID" }),
    },
  });

  return { ok: true, factureId: facture.id, reference: facture.reference, created, linked: unlinked.length };
}
