import type { TKey } from "@/lib/i18n";

export const CATALOG_CATEGORIES = ["SANITAIRE", "DECO_LUMINAIRE", "MEUBLE"] as const;
export type CatalogCategoryKey = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategoryKey, string> = {
  SANITAIRE: "Sanitaire",
  DECO_LUMINAIRE: "Déco & Luminaire",
  MEUBLE: "Meuble",
};

export const CATALOG_CATEGORY_DESCRIPTIONS: Record<CatalogCategoryKey, string> = {
  SANITAIRE: "WC, vasques, robinetterie, douches, baignoires et accessoires de salle de bain.",
  DECO_LUMINAIRE: "Lustres, appliques, spots LED, miroirs et objets de décoration.",
  MEUBLE: "Salons, chambres, bureaux, cuisines et mobilier sur mesure.",
};

// Clés i18n de la page publique /catalogue
export const CATALOG_CATEGORY_I18N: Record<CatalogCategoryKey, { title: TKey; desc: TKey }> = {
  SANITAIRE: { title: "pcat.cat.sanitaire", desc: "pcat.cat.sanitaire.desc" },
  DECO_LUMINAIRE: { title: "pcat.cat.deco", desc: "pcat.cat.deco.desc" },
  MEUBLE: { title: "pcat.cat.meuble", desc: "pcat.cat.meuble.desc" },
};

export const CATALOG_ORDER_STATUSES = [
  "PENDING",
  "QUOTED",
  "CONFIRMED",
  "IN_PREPARATION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type CatalogOrderStatusKey = (typeof CATALOG_ORDER_STATUSES)[number];

// Statuts que le staff pose à la main (PENDING / QUOTED découlent du devis)
export const CATALOG_STAFF_STATUSES = ["CONFIRMED", "IN_PREPARATION", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export const CATALOG_ORDER_STATUS_LABELS: Record<CatalogOrderStatusKey, string> = {
  PENDING: "Devis en préparation",
  QUOTED: "Devis envoyé",
  CONFIRMED: "Devis accepté",
  IN_PREPARATION: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const CATALOG_ORDER_STATUS_TONE: Record<
  CatalogOrderStatusKey,
  "warning" | "info" | "success" | "destructive" | "secondary" | "default"
> = {
  PENDING: "warning",
  QUOTED: "info",
  CONFIRMED: "success",
  IN_PREPARATION: "default",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "secondary",
};

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
