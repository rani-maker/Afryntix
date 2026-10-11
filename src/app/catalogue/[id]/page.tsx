import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATALOG_CATEGORY_LABELS } from "@/lib/catalog-labels";
import { CatalogViewer } from "./catalog-viewer";

// Consultation d'un catalogue dans le site (visionneuse page par page).
// Public pour les catalogues actifs ; les catalogues masqués restent
// consultables par le staff / l'admin.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; x?: string; y?: string }> };

const unit = (v: string | undefined) => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
};

const getCatalog = cache(async (id: string) => {
  const [catalog, session] = await Promise.all([
    prisma.catalog.findUnique({
      where: { id },
      select: { id: true, title: true, description: true, category: true, active: true },
    }),
    auth(),
  ]);
  const role = session?.user?.role;
  const isTeam = role === "ADMIN" || role === "STAFF";
  if (!catalog || (!catalog.active && !isTeam)) return null;
  return { catalog, canOrder: !role || role === "CLIENT" };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getCatalog(id);
  if (!found) return { title: "Catalogue", robots: { index: false, follow: false } };
  const { catalog } = found;
  const description =
    catalog.description ??
    `Catalogue ${CATALOG_CATEGORY_LABELS[catalog.category]} AFRYNTIX : consultez-le en ligne et commandez sur devis.`;
  return {
    // `absolute` : le titre texte de catalogue/layout.tsx coupe le gabarit « %s | AFRYNTIX » de la racine
    title: { absolute: `${catalog.title} — Catalogue ${CATALOG_CATEGORY_LABELS[catalog.category]} | AFRYNTIX` },
    description,
    openGraph: { title: `${catalog.title} | AFRYNTIX`, description, url: `/catalogue/${catalog.id}` },
    alternates: { canonical: `/catalogue/${catalog.id}` },
    ...(catalog.active ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function CatalogViewerPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const found = await getCatalog(id);
  if (!found) notFound();

  // ?page=12&x=0.62&y=0.4 : ouvre sur la page, repère à l'endroit touché (lien des lignes de commande)
  const page = Number(query.page);
  const focus =
    Number.isInteger(page) && page >= 1 ? { page, x: unit(query.x), y: unit(query.y) } : undefined;

  return (
    <CatalogViewer
      catalogId={found.catalog.id}
      title={found.catalog.title}
      canOrder={found.canOrder}
      focus={focus}
    />
  );
}
