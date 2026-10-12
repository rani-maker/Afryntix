import data from "@/data/shop-products.json";
import type { TKey } from "@/lib/i18n";

/**
 * Articles à prix affichés (/catalogue/produits) : sanitaire et déco & luminaires.
 * Les données viennent de `src/data/shop-products.json`, généré par
 * `scripts/build-shop-catalog.mjs` à partir des classeurs de prix. Ce fichier ne
 * contient ni prix d'usine ni référence fournisseur.
 */
export type ShopFamily = "SANITAIRE" | "DECO_LUMINAIRE";

export type ShopProduct = {
  ref: string; // AFR-WC-001
  family: ShopFamily;
  cat: string; // code de catégorie (WC, LAV, PLA…)
  n: number; // numéro du modèle dans sa catégorie
  spec?: string; // puissance, dimensions
  eco?: boolean; // gamme éco
  price: number; // FCFA, prix de l'article
  freight: number; // FCFA, fret + dédouanement pour une pièce
};

export type ShopCategory = { code: string; family: ShopFamily; label: string; count: number };

export const SHOP_FAMILIES: readonly ShopFamily[] = ["SANITAIRE", "DECO_LUMINAIRE"];
export const SHOP_CATEGORIES = data.categories as ShopCategory[];
export const SHOP_PRODUCTS = data.products as ShopProduct[];

// Titre porté par les lignes de commande (colonne « Catalogue »)
export const SHOP_CATALOG_TITLE = "Articles à prix affichés";

const byRef = new Map(SHOP_PRODUCTS.map((p) => [p.ref, p]));
const categoryByCode = new Map(SHOP_CATEGORIES.map((c) => [c.code, c]));

export function getShopProduct(ref: string | null | undefined): ShopProduct | null {
  return (ref && byRef.get(ref)) || null;
}

/**
 * Photos dans `public/produits/<version>/` : le dossier change de nom quand les
 * photos sont régénérées, ce qui permet un cache navigateur d'un an (next.config.ts).
 */
const SHOP_IMAGE_BASE = "/produits/v1";

export function shopImageUrl(ref: string, size: "thumb" | "full" = "full"): string {
  return `${SHOP_IMAGE_BASE}/${size === "thumb" ? "t/" : ""}${ref.toLowerCase()}.webp`;
}

/** Ouvre le catalogue sur la fiche de l'article. */
export function shopProductHref(ref: string): string {
  return `/catalogue/produits?ref=${encodeURIComponent(ref)}`;
}

/**
 * Photo d'une ligne de commande passée depuis ce catalogue (la ligne ne garde que
 * la référence). null pour les lignes venues d'un catalogue PDF.
 */
export function shopOrderItemImage(item: { catalogId: string | null; reference: string }): string | null {
  return !item.catalogId && byRef.has(item.reference) ? shopImageUrl(item.reference, "thumb") : null;
}

export const shopCategoryKey = (code: string) => `pshop.cat.${code}` as TKey;

/** Nom en français, tel qu'il est écrit sur les commandes et les devis. */
export function shopProductName(p: ShopProduct): string {
  return formatShopProductName(p, {
    category: categoryByCode.get(p.cat)?.label ?? p.cat,
    model: "modèle",
    eco: "gamme éco",
  });
}

export function formatShopProductName(p: ShopProduct, words: { category: string; model: string; eco: string }): string {
  return `${words.category} – ${words.model} ${p.n}${p.spec ? ` · ${p.spec}` : ""}${p.eco ? ` (${words.eco})` : ""}`;
}

/** Montants d'un ensemble de lignes (prix de l'article et fret par pièce × quantité). */
export function shopTotals(lines: { product: ShopProduct; quantity: number }[]) {
  let items = 0;
  let freight = 0;
  for (const { product, quantity } of lines) {
    items += product.price * quantity;
    freight += product.freight * quantity;
  }
  return { items, freight, total: items + freight };
}
