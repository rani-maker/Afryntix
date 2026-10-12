import { prisma } from "@/lib/prisma";
import { SHOP_CATEGORIES, SHOP_FAMILIES, shopImageUrl, type ShopFamily } from "@/lib/shop-products";
import { CataloguePublicClient } from "./catalogue-client";

export const dynamic = "force-dynamic";

// Rayons du catalogue d'articles à prix affichés, avec l'article qui les illustre
const SHOP_ENTRIES: Record<ShopFamily, { slug: string; cover: string }> = {
  SANITAIRE: { slug: "sanitaire", cover: "AFR-WC-024" },
  DECO_LUMINAIRE: { slug: "luminaires", cover: "AFR-SUS-005" },
};

export default async function PublicCataloguePage() {
  const catalogs = await prisma.catalog.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, category: true, title: true, description: true, fileSize: true, coverPath: true },
  });

  return (
    <CataloguePublicClient
      catalogs={catalogs.map(({ coverPath, ...c }) => ({ ...c, hasCover: !!coverPath }))}
      shop={SHOP_FAMILIES.map((family) => ({
        family,
        slug: SHOP_ENTRIES[family].slug,
        count: SHOP_CATEGORIES.reduce((n, c) => n + (c.family === family ? c.count : 0), 0),
        image: shopImageUrl(SHOP_ENTRIES[family].cover, "thumb"),
      }))}
    />
  );
}
