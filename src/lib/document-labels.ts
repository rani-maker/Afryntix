// Constantes d'affichage et de filtrage des documents.
// Extraites de `src/server/actions/documents.ts` car un fichier `"use server"`
// ne peut exporter que des fonctions async (contrainte Next.js 15).

export const DOCUMENT_TYPES = [
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "MASTER_AIR_WAYBILL",
  "PACKING_LIST",
  "COMMERCIAL_INVOICE",
  "CERTIFICATE_OF_ORIGIN",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "PROOF_OF_DELIVERY",
  "CONTAINER_MANIFEST",
  "PHOTO",
  "OTHER",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  BILL_OF_LADING: "Connaissement (B/L)",
  AIR_WAYBILL: "AWB (House)",
  MASTER_AIR_WAYBILL: "Master AWB",
  PACKING_LIST: "Packing list",
  COMMERCIAL_INVOICE: "Facture commerciale",
  CERTIFICATE_OF_ORIGIN: "Certificat d'origine",
  CUSTOMS_DECLARATION: "Déclaration douanière",
  INSURANCE_CERTIFICATE: "Certificat d'assurance",
  PROOF_OF_DELIVERY: "Preuve de livraison",
  CONTAINER_MANIFEST: "Manifeste container",
  PHOTO: "Photo",
  OTHER: "Autre",
};

export const DOCUMENT_TYPES_FOR_SHIPMENT: (typeof DOCUMENT_TYPES)[number][] = [
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "PACKING_LIST",
  "COMMERCIAL_INVOICE",
  "CERTIFICATE_OF_ORIGIN",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "PROOF_OF_DELIVERY",
  "PHOTO",
  "OTHER",
];

export const DOCUMENT_TYPES_FOR_ENVOI: (typeof DOCUMENT_TYPES)[number][] = [
  "MASTER_AIR_WAYBILL",
  "BILL_OF_LADING",
  "CONTAINER_MANIFEST",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "OTHER",
];
