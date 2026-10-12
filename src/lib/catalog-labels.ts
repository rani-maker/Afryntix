import type { TKey } from "@/lib/i18n";

// Ordre d'affichage des catégories (indépendant de l'ordre de l'enum en base)
export const CATALOG_CATEGORIES = ["SANITAIRE", "CARREAUX", "DECO_LUMINAIRE", "MEUBLE"] as const;
export type CatalogCategoryKey = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategoryKey, string> = {
  SANITAIRE: "Sanitaire",
  CARREAUX: "Carreaux",
  DECO_LUMINAIRE: "Déco & Luminaire",
  MEUBLE: "Meuble",
};

export const CATALOG_CATEGORY_DESCRIPTIONS: Record<CatalogCategoryKey, string> = {
  SANITAIRE: "WC, vasques, robinetterie, douches, baignoires et accessoires de salle de bain.",
  CARREAUX: "Carreaux de sol et muraux, grès cérame, faïence, marbre, mosaïque et plinthes.",
  DECO_LUMINAIRE: "Lustres, appliques, spots LED, miroirs et objets de décoration.",
  MEUBLE: "Salons, chambres, bureaux, cuisines et mobilier sur mesure.",
};

// Clés i18n de la page publique /catalogue
export const CATALOG_CATEGORY_I18N: Record<CatalogCategoryKey, { title: TKey; desc: TKey }> = {
  SANITAIRE: { title: "pcat.cat.sanitaire", desc: "pcat.cat.sanitaire.desc" },
  CARREAUX: { title: "pcat.cat.carreaux", desc: "pcat.cat.carreaux.desc" },
  DECO_LUMINAIRE: { title: "pcat.cat.deco", desc: "pcat.cat.deco.desc" },
  MEUBLE: { title: "pcat.cat.meuble", desc: "pcat.cat.meuble.desc" },
};

// Panier (articles choisis en touchant une page dans la visionneuse)
export const CART_MAX_ITEMS = 40;

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

// Commande « en cours » : ni livrée ni annulée (tableau de bord client, statistiques)
export const CATALOG_ORDER_ACTIVE_STATUSES = ["PENDING", "QUOTED", "CONFIRMED", "IN_PREPARATION", "SHIPPED"] as const;
// Devis accepté et commande lancée (les annulations sont exclues)
export const CATALOG_ORDER_VALIDATED_STATUSES = ["CONFIRMED", "IN_PREPARATION", "SHIPPED", "DELIVERED"] as const;

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

type OrderQuoteState = {
  status: CatalogOrderStatusKey;
  totalAmount: number | null;
  quotedAt: Date | null;
  acceptedAt: Date | null;
};

/**
 * Commande passée aux prix affichés (/catalogue/produits) : confirmée par le client dès le
 * panier, sans devis. Si l'équipe la corrige ensuite, elle repasse par un devis (`quotedAt`)
 * et n'est plus « directe ».
 */
export function isDirectOrder(o: Pick<OrderQuoteState, "quotedAt" | "acceptedAt">): boolean {
  return o.quotedAt == null && o.acceptedAt != null;
}

/** Le client voit les montants : devis envoyé par AFRYNTIX, ou commande passée aux prix affichés. */
export function orderAmountsVisible(o: OrderQuoteState): boolean {
  return o.totalAmount != null && o.status !== "PENDING" && (o.quotedAt != null || o.acceptedAt != null);
}

/** Libellé du statut : une commande directe confirmée n'a pas de « devis accepté ». */
export function catalogOrderStatusLabel(o: Pick<OrderQuoteState, "status" | "quotedAt" | "acceptedAt">): string {
  return o.status === "CONFIRMED" && isDirectOrder(o) ? "Commande confirmée" : CATALOG_ORDER_STATUS_LABELS[o.status];
}

// Libellés des montants : « fret + dédouanement » pour une commande aux prix affichés
export const ORDER_FEES_LABEL = "Frais annexes (transport, emballage…)";
export const DIRECT_ORDER_FEES_LABEL = "Fret + dédouanement";

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
