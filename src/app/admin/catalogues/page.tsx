import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CatalogManager } from "./catalog-manager";

export default async function AdminCataloguesPage() {
  const catalogs = await prisma.catalog.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { orderItems: true } } },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Catalogues</CardTitle>
          <CardDescription>
            Déposez les catalogues PDF Sanitaire, Déco &amp; Luminaire et Meuble. Ils apparaissent sur la page publique
            /catalogue et dans l&apos;espace client, où les clients passent commande.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatalogManager
            catalogs={catalogs.map((c) => ({
              id: c.id,
              category: c.category,
              title: c.title,
              description: c.description,
              fileName: c.fileName,
              fileSize: c.fileSize,
              hasCover: !!c.coverPath,
              active: c.active,
              orderLines: c._count.orderItems,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
