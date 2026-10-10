import { prisma } from "@/lib/prisma";
import { CataloguePublicClient } from "./catalogue-client";

export const dynamic = "force-dynamic";

export default async function PublicCataloguePage() {
  const catalogs = await prisma.catalog.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, category: true, title: true, description: true, fileSize: true, coverPath: true },
  });

  return (
    <CataloguePublicClient
      catalogs={catalogs.map(({ coverPath, ...c }) => ({ ...c, hasCover: !!coverPath }))}
    />
  );
}
