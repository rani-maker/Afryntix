// Constantes d'affichage des réclamations.
// Extraites de `src/server/actions/claims.ts` car un fichier `"use server"`
// ne peut exporter que des fonctions async (contrainte Next.js 15).

export const CLAIM_TYPES = ["LOSS", "DAMAGE", "DELAY", "MISSING_ITEM", "WRONG_ITEM", "OTHER"] as const;
export const CLAIM_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", "CANCELLED"] as const;

export const CLAIM_TYPE_LABELS: Record<(typeof CLAIM_TYPES)[number], string> = {
  LOSS: "Perte",
  DAMAGE: "Casse / dommage",
  DELAY: "Retard",
  MISSING_ITEM: "Manquant",
  WRONG_ITEM: "Erreur de marchandise",
  OTHER: "Autre",
};

export const CLAIM_STATUS_LABELS: Record<(typeof CLAIM_STATUSES)[number], string> = {
  OPEN: "Ouverte",
  UNDER_REVIEW: "En cours",
  RESOLVED: "Résolue",
  REJECTED: "Rejetée",
  CANCELLED: "Annulée",
};

export const CLAIM_STATUS_TONE: Record<
  (typeof CLAIM_STATUSES)[number],
  "warning" | "info" | "success" | "destructive" | "secondary"
> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  RESOLVED: "success",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};
