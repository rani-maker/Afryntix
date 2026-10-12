import type { Metadata } from "next";
import { SHOP_CATEGORIES, SHOP_PRODUCTS, getShopProduct, type ShopFamily } from "@/lib/shop-products";
import { ProductsClient } from "./products-client";

export const metadata: Metadata = {
  title: "Sanitaire et luminaires à prix affichés",
  description: `${SHOP_PRODUCTS.length} articles sanitaire et déco & luminaires importés de Chine, avec photo, prix et fret + dédouanement : WC, lavabos, colonnes de douche, robinets, plafonniers LED, suspensions, lustres, appliques. Commande en ligne, livraison en Afrique de l'Ouest.`,
  keywords: [
    "prix WC Abidjan",
    "sanitaire Chine Côte d'Ivoire prix",
    "plafonnier LED prix Abidjan",
    "lustre importation Chine",
    "colonne de douche prix FCFA",
  ],
  openGraph: {
    title: "Sanitaire et luminaires à prix affichés | AFRYNTIX",
    description:
      "WC, lavabos, douches, robinets, plafonniers, suspensions, lustres : prix affichés, commande en ligne.",
    url: "/catalogue/produits",
  },
  alternates: { canonical: "/catalogue/produits" },
};

const FAMILY_SLUGS: Record<string, ShopFamily> = { sanitaire: "SANITAIRE", luminaires: "DECO_LUMINAIRE" };

type Props = { searchParams: Promise<{ famille?: string; cat?: string; ref?: string }> };

// Catalogue d'articles à prix affichés : public. `?famille=` et `?cat=` ouvrent un
// rayon, `?ref=` ouvre la fiche d'un article (lien depuis une commande).
export default async function ProductsPage({ searchParams }: Props) {
  const { famille, cat, ref } = await searchParams;
  const product = getShopProduct(ref?.toUpperCase());
  const category = SHOP_CATEGORIES.find((c) => c.code === (product?.cat ?? cat?.toUpperCase())) ?? null;
  const family = category?.family ?? FAMILY_SLUGS[famille ?? ""] ?? "SANITAIRE";

  return (
    <ProductsClient initialFamily={family} initialCategory={category?.code ?? null} initialRef={product?.ref ?? null} />
  );
}
