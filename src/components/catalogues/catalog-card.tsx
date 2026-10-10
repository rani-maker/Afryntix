import Image from "next/image";
import Link from "next/link";
import { Bath, FileText, Lamp, ShoppingBag, Sofa } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATALOG_CATEGORY_LABELS, formatFileSize, type CatalogCategoryKey } from "@/lib/catalog-labels";

export const CATALOG_CATEGORY_ICONS: Record<CatalogCategoryKey, typeof Bath> = {
  SANITAIRE: Bath,
  DECO_LUMINAIRE: Lamp,
  MEUBLE: Sofa,
};

export type CatalogCardData = {
  id: string;
  category: CatalogCategoryKey;
  title: string;
  description: string | null;
  fileSize: number | null;
  hasCover: boolean;
};

/** Carte catalogue de l'espace client (consulter le PDF / commander). */
export function CatalogCard({ catalog }: { catalog: CatalogCardData }) {
  const Icon = CATALOG_CATEGORY_ICONS[catalog.category];
  const fileHref = `/api/catalogue/${catalog.id}/file`;
  return (
    <article className="group flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <a
        href={fileHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Consulter ${catalog.title}`}
        className="block h-40 relative overflow-hidden bg-primary/5"
      >
        {catalog.hasCover ? (
          <Image
            src={`/api/catalogue/${catalog.id}/cover`}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Icon className="absolute right-4 bottom-4 h-12 w-12 text-primary/50" />
        )}
      </a>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {CATALOG_CATEGORY_LABELS[catalog.category]}
        </div>
        <h3 className="font-semibold leading-snug">{catalog.title}</h3>
        {catalog.description && <p className="text-sm text-muted-foreground">{catalog.description}</p>}
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> PDF
          {catalog.fileSize ? ` · ${formatFileSize(catalog.fileSize)}` : ""}
        </div>
        <div className="flex gap-2 mt-auto pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={fileHref} target="_blank" rel="noopener noreferrer">
              Consulter
            </a>
          </Button>
          <Button asChild size="sm" className="flex-1">
            <Link href={`/dashboard/catalogue/order?catalog=${catalog.id}`}>
              <ShoppingBag className="h-4 w-4" /> Commander
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
