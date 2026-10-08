import { cache } from "react";
import type { CargoCategory, TransportMode } from "@prisma/client";
import { prisma } from "./prisma";
import { CARGO_CATEGORY_LABELS, CARRIER_LABELS, TRANSPORT_MODE_LABELS } from "./pricing";
import { formatXOF } from "./utils";

export type InvoiceLine = {
  tracking: string;
  description: string | null;
  modeLabel: string;
  categoryLabel: string;
  pieces: number;
  quantityLabel: string;
  unitPriceLabel: string | null;
  amount: number;
  extras: string[];
};

export type InvoicePaymentState = "PAID" | "DEPOSIT" | "PARTIAL" | "UNPAID";

export type InvoiceDoc = {
  id: string;
  reference: string;
  issuedAt: Date;
  /** Comptes clients autorisés à consulter cette facture une fois connectés. */
  ownerUserIds: string[];
  billTo: {
    name: string;
    phone: string | null;
    shippingMark: string | null;
    accountName: string | null;
    email: string | null;
    destination: string | null;
    address: string | null;
  };
  voyage: {
    reference: string;
    modeLabel: string;
    route: string;
    departureDate: Date | null;
    arrivalDate: Date | null;
    carrier: string | null;
    transportRef: string | null;
    containers: string | null;
  } | null;
  lines: InvoiceLine[];
  totals: {
    pieces: number;
    total: number;
    deposit: number;
    paid: number;
    remaining: number;
    state: InvoicePaymentState;
  };
  notes: string | null;
};

const qty = (n: number, digits: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

// Base de facturation d'un colis (ce sur quoi le prix unitaire s'applique).
function billingBasis(s: {
  mode: TransportMode;
  category: CargoCategory;
  pieces: number;
  weightKg: number | null;
  chargeableWeight: number | null;
  volumeCBM: number | null;
}): { quantity: number | null; unit: string; label: string } {
  const pcs = (unit: string) => ({ quantity: s.pieces, unit, label: `${s.pieces} ${unit}${s.pieces > 1 ? "s" : ""}` });
  switch (s.mode) {
    case "AIR_EXPRESS":
    case "AIR_NORMAL": {
      if (s.category === "PHONE" || s.category === "COMPUTER") return pcs("pièce");
      const kg = s.chargeableWeight ?? s.weightKg;
      return { quantity: kg, unit: "kg", label: kg != null ? `${qty(kg, 2)} kg` : "—" };
    }
    case "SEA_LCL":
    case "STORAGE":
      return { quantity: s.volumeCBM, unit: "m³", label: s.volumeCBM != null ? `${qty(s.volumeCBM, 3)} m³` : "—" };
    case "SEA_FCL":
      return { quantity: null, unit: "forfait", label: s.volumeCBM != null ? `${qty(s.volumeCBM, 3)} m³` : "Forfait" };
    case "VEHICLE":
      return pcs("véhicule");
    case "BTP_EQUIPMENT":
      return pcs("équipement");
  }
}

// Numéros ivoiriens (+225XXXXXXXXXX, 225XXXXXXXXXX ou 0XXXXXXXXX) -> +225 07 06 26 04 05 ; les autres sont laissés tels quels.
function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const m = /^(?:\+?225)?(0\d{9})$/.exec(phone.replace(/[\s.-]/g, ""));
  return m ? `+225 ${m[1].replace(/(\d{2})(?=\d)/g, "$1 ")}` : phone;
}

const shipmentInclude = {
  envoi: true,
  container: { select: { refInternal: true, carrierNumber: true } },
  shippingMark: { include: { user: { select: { name: true, email: true } } } },
  client: { select: { name: true, email: true, phone: true, whatsapp: true } },
} as const;

// cache() : generateMetadata et la page chargent la même facture, une seule lecture par requête.
export const getInvoiceDoc = cache(async (factureId: string): Promise<InvoiceDoc | null> => {
  const facture = await prisma.facture.findUnique({
    where: { id: factureId },
    include: {
      shippingMark: { include: { user: { select: { name: true, email: true } } } },
      client: { select: { name: true, email: true, phone: true, whatsapp: true } },
      envoi: true,
      shipments: { where: { status: { not: "CANCELLED" } }, include: shipmentInclude },
    },
  });
  if (!facture) return null;

  // Une facture « voyage + shipping mark » couvre tous les colis de ce client sur ce voyage,
  // y compris ceux qui n'y ont pas encore été rattachés en base.
  const unlinked =
    facture.envoiId && facture.shippingMarkId
      ? await prisma.shipment.findMany({
          where: {
            envoiId: facture.envoiId,
            shippingMarkId: facture.shippingMarkId,
            factureId: null,
            status: { not: "CANCELLED" },
          },
          include: shipmentInclude,
        })
      : [];
  const ships = [...facture.shipments, ...unlinked].sort((a, b) =>
    a.trackingNumber.localeCompare(b.trackingNumber),
  );
  const first = ships[0];
  const mark = facture.shippingMark ?? first?.shippingMark ?? null;
  const client = facture.client ?? first?.client ?? null;
  const envoi = facture.envoi ?? first?.envoi ?? null;

  const lines: InvoiceLine[] = ships.map((s) => {
    const basis = billingBasis(s);
    const insurance = s.insuranceOptedIn ? (s.insurancePremium ?? 0) : 0;
    const storage = s.storageFeeAmount ?? 0;
    const transport = s.totalAmount - insurance - storage;
    // Le prix unitaire n'est affiché que s'il explique réellement le montant (sinon : forfait, tarif négocié…).
    const consistent =
      s.unitPrice != null &&
      basis.quantity != null &&
      Math.abs(s.unitPrice * basis.quantity - transport) <= Math.max(2, transport * 0.005);
    const extras: string[] = [];
    if (insurance > 0) extras.push(`Assurance cargo incluse : ${formatXOF(insurance)}`);
    if (storage > 0) {
      extras.push(
        `Frais d'entreposage inclus : ${formatXOF(storage)}${s.storageDaysCharged ? ` (${s.storageDaysCharged} j)` : ""}`,
      );
    }
    return {
      tracking: s.trackingNumber,
      description: s.description,
      modeLabel: TRANSPORT_MODE_LABELS[s.mode],
      categoryLabel: CARGO_CATEGORY_LABELS[s.category],
      pieces: s.pieces,
      quantityLabel: basis.label,
      unitPriceLabel: consistent ? `${formatXOF(s.unitPrice!)} / ${basis.unit}` : null,
      amount: s.totalAmount,
      extras,
    };
  });

  // Les colis font foi pour les montants ; la facture seule sert de repli si elle n'a plus de colis liés.
  const total = ships.length ? ships.reduce((sum, s) => sum + s.totalAmount, 0) : facture.totalAmount;
  const paid = Math.min(total, ships.length ? ships.reduce((sum, s) => sum + s.amountPaid, 0) : facture.amountPaid);
  const deposit = Math.round(total * 0.5);
  const remaining = Math.max(0, Math.round(total - paid));
  const state: InvoicePaymentState =
    total > 0 && remaining === 0 ? "PAID" : paid >= deposit && paid > 0 ? "DEPOSIT" : paid > 0 ? "PARTIAL" : "UNPAID";

  const containers = [
    ...new Set(
      ships
        .filter((s) => s.container)
        .map((s) => `${s.container!.refInternal}${s.container!.carrierNumber ? ` · ${s.container!.carrierNumber}` : ""}`),
    ),
  ];
  const transportRef = envoi
    ? envoi.vesselName
      ? `${envoi.vesselName}${envoi.voyageNumber ? ` / ${envoi.voyageNumber}` : ""}`
      : envoi.mawb
        ? `MAWB ${envoi.mawb}${envoi.flightNumber ? ` / ${envoi.flightNumber}` : ""}`
        : (envoi.flightNumber ?? envoi.bookingNumber ?? null)
    : null;

  const billName =
    mark?.name ?? client?.name ?? first?.recipientName ?? first?.clientName ?? "Client";
  const accountName = mark?.user?.name ?? client?.name ?? null;

  return {
    id: facture.id,
    reference: facture.reference,
    issuedAt: facture.createdAt,
    ownerUserIds: [facture.clientId, mark?.userId].filter((v): v is string => !!v),
    billTo: {
      name: billName,
      phone: formatPhone(
        mark?.whatsapp || mark?.phone || client?.whatsapp || client?.phone || first?.clientPhone || null,
      ),
      shippingMark: mark?.name ?? null,
      accountName: accountName && accountName !== billName ? accountName : null,
      email: mark?.user?.email ?? client?.email ?? null,
      destination: first ? [first.destinationCity, first.destinationCountry].filter(Boolean).join(", ") || null : null,
      address: first?.recipientAddress ?? null,
    },
    voyage: envoi
      ? {
          reference: envoi.reference,
          modeLabel: TRANSPORT_MODE_LABELS[envoi.mode],
          route: `${envoi.origin} → ${envoi.destination}`,
          departureDate: envoi.departureDate,
          arrivalDate: envoi.arrivalDate,
          carrier: envoi.carrier ? CARRIER_LABELS[envoi.carrier] : null,
          transportRef,
          containers: containers.length ? containers.join(", ") : null,
        }
      : null,
    lines,
    totals: { pieces: ships.reduce((sum, s) => sum + s.pieces, 0), total, deposit, paid, remaining, state },
    notes: facture.notes,
  };
});
