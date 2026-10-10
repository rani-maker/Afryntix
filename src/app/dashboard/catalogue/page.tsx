import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { CatalogCard } from "@/components/catalogues/catalog-card";
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_DESCRIPTIONS,
  CATALOG_CATEGORY_LABELS,
  type CatalogCategoryKey,
} from "@/lib/catalog-labels";

export default async function ClientCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { cat } = await searchParams;
  const category = CATALOG_CATEGORIES.includes(cat as CatalogCategoryKey) ? (cat as CatalogCategoryKey) : null;

  const all = await prisma.catalog.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, category: true, title: true, description: true, fileSize: true, coverPath: true },
  });
  const rows = category ? all.filter((c) => c.category === category) : all;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Catalogues</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {category
              ? CATALOG_CATEGORY_DESCRIPTIONS[category]
              : "Sanitaire, Déco & Luminaire, Meuble : consultez un catalogue, notez les références qui vous intéressent, puis validez votre bon de commande. AFRYNTIX vous envoie un devis."}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">Mes commandes</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/catalogue/order">+ Nouvelle commande</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Link
          href="/dashboard/catalogue"
          className={`px-3 py-1 rounded-full border ${!category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          Tous ({all.length})
        </Link>
        {CATALOG_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/dashboard/catalogue?cat=${c}`}
            className={`px-3 py-1 rounded-full border ${category === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {CATALOG_CATEGORY_LABELS[c]} ({all.filter((x) => x.category === c).length})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Aucun catalogue disponible pour le moment dans cette catégorie.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {rows.map(({ coverPath, ...c }) => (
            <CatalogCard key={c.id} catalog={{ ...c, hasCover: !!coverPath }} />
          ))}
        </div>
      )}
    </div>
  );
}
