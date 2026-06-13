/**
 * Génération de manifeste (Colist) au format CSV et HTML.
 * Utilisé pour l'export d'un envoi ou d'un container.
 */

export type ManifestRow = {
  trackingNumber: string;
  shippingMark: string | null;
  client: string;
  pieces: number;
  weightKg: number | null;
  volumetricWeight: number | null;
  chargeableWeight: number | null;
  volumeCBM: number | null;
  description: string | null;
  destination: string;
  category: string;
  totalAmount: number;
  status: string;
  hsCode?: string | null;
  incoterm?: string | null;
  countryOfOrigin?: string | null;
  declaredCustomsValue?: number | null;
};

export type ManifestHeader = {
  envoiReference: string;
  envoiMode: string;
  origin: string;
  destination: string;
  departureDate: Date | null;
  arrivalDate: Date | null;
  carrier: string | null;
  bookingNumber: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  mawb: string | null;
  flightNumber: string | null;
  containerLabel?: string | null;
};

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type ManifestAudience = "internal" | "forwarder";

export function buildManifestCsv(
  header: ManifestHeader,
  rows: ManifestRow[],
  audience: ManifestAudience = "internal",
): string {
  const lines: string[] = [];
  // Méta-en-tête (commentaires CSV — certains lecteurs les ignorent, mais ils restent lisibles)
  lines.push(`# MANIFESTE AFRYNTIX`);
  if (audience === "forwarder") {
    lines.push(`# Version transitaire — informations destinataires masquees`);
  }
  lines.push(`# Envoi: ${header.envoiReference}`);
  lines.push(`# Mode: ${header.envoiMode}`);
  lines.push(`# Itinéraire: ${header.origin} -> ${header.destination}`);
  if (header.carrier) lines.push(`# Carrier: ${header.carrier}`);
  if (header.bookingNumber) lines.push(`# Booking: ${header.bookingNumber}`);
  if (header.vesselName) lines.push(`# Navire: ${header.vesselName} / Voyage: ${header.voyageNumber ?? ""}`);
  if (header.mawb) lines.push(`# MAWB: ${header.mawb} / Vol: ${header.flightNumber ?? ""}`);
  if (header.containerLabel) lines.push(`# Container: ${header.containerLabel}`);
  if (header.departureDate) lines.push(`# Départ: ${header.departureDate.toISOString().slice(0, 10)}`);
  if (header.arrivalDate) lines.push(`# Arrivée: ${header.arrivalDate.toISOString().slice(0, 10)}`);
  lines.push(``);

  // En-tête tableau
  lines.push(
    [
      "Tracking",
      "Shipping Mark",
      "Client",
      "Pieces",
      "Poids reel (kg)",
      "Poids volumique (kg)",
      "Poids taxable (kg)",
      "Volume (CBM)",
      "Categorie",
      "Description",
      "Destination",
      "Code SH",
      "Incoterm",
      "Origine",
      "Valeur douaniere (FCFA)",
      "Montant (FCFA)",
      "Statut",
    ]
      .map(escapeCsv)
      .join(";"),
  );

  for (const r of rows) {
    lines.push(
      [
        r.trackingNumber,
        r.shippingMark ?? "",
        r.client,
        r.pieces,
        r.weightKg ?? "",
        r.volumetricWeight != null ? r.volumetricWeight.toFixed(2) : "",
        r.chargeableWeight != null ? r.chargeableWeight.toFixed(2) : "",
        r.volumeCBM != null ? r.volumeCBM.toFixed(3) : "",
        r.category,
        r.description ?? "",
        r.destination,
        r.hsCode ?? "",
        r.incoterm ?? "",
        r.countryOfOrigin ?? "",
        r.declaredCustomsValue ?? "",
        r.totalAmount,
        r.status,
      ]
        .map(escapeCsv)
        .join(";"),
    );
  }

  // Totaux
  const totalPieces = rows.reduce((s, r) => s + r.pieces, 0);
  const totalWeight = rows.reduce((s, r) => s + (r.weightKg ?? 0), 0);
  const totalChargeable = rows.reduce((s, r) => s + (r.chargeableWeight ?? 0), 0);
  const totalCBM = rows.reduce((s, r) => s + (r.volumeCBM ?? 0), 0);
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  lines.push(``);
  lines.push(
    [
      "TOTAL",
      "",
      `${rows.length} colis`,
      totalPieces,
      totalWeight.toFixed(2),
      "",
      totalChargeable.toFixed(2),
      totalCBM.toFixed(3),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalAmount,
      "",
    ]
      .map(escapeCsv)
      .join(";"),
  );

  // BOM UTF-8 pour qu'Excel reconnaisse les accents
  return "﻿" + lines.join("\n");
}
