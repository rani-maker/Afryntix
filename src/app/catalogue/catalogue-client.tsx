"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, FileText, Lamp, ShoppingBag, Sofa } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_I18N,
  formatFileSize,
  type CatalogCategoryKey,
} from "@/lib/catalog-labels";
import type { TKey } from "@/lib/i18n";

export type PublicCatalog = {
  id: string;
  category: CatalogCategoryKey;
  title: string;
  description: string | null;
  fileSize: number | null;
  hasCover: boolean;
};

const CATEGORY_STYLE: Record<CatalogCategoryKey, { icon: typeof Bath; motif: string; anchor: string }> = {
  SANITAIRE: { icon: Bath, motif: "afx-motif-stripe bg-mint-pale", anchor: "sanitaire" },
  DECO_LUMINAIRE: { icon: Lamp, motif: "afx-motif-diamond bg-surface-3", anchor: "deco-luminaire" },
  MEUBLE: { icon: Sofa, motif: "afx-motif-bg bg-surface-2", anchor: "meuble" },
};

const HOW_KEYS: TKey[] = ["pcat.how.1", "pcat.how.2", "pcat.how.3"];

export function CataloguePublicClient({ catalogs }: { catalogs: PublicCatalog[] }) {
  const { t } = useLang();

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/catalogue" />

      {/* Hero */}
      <section className="container px-6 md:px-12 pt-16 pb-10">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div className="flex flex-col gap-4 max-w-3xl">
            <span className="afx-kicker">{t("pcat.kicker")}</span>
            <h1 className="afx-h1">
              {t("pcat.title")}
              <br />
              <span className="italic text-mint-3">{t("pcat.title.accent")}</span>
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed">{t("pcat.lead")}</p>
          </div>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-mint text-ink hover:bg-mint-2 h-12 px-6 text-[15px] font-semibold"
          >
            <Link href="/dashboard/catalogue/order">
              {t("pcat.cta")} <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        <nav className="flex flex-wrap gap-2 mt-8" aria-label="Catégories">
          {CATALOG_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_STYLE[cat].icon;
            const n = catalogs.filter((c) => c.category === cat).length;
            return (
              <a
                key={cat}
                href={`#${CATEGORY_STYLE[cat].anchor}`}
                className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-4 h-10 text-sm font-medium text-ink-2 hover:text-ink hover:border-mint-3 transition-colors"
              >
                <Icon className="h-4 w-4 text-mint-3" />
                {t(CATALOG_CATEGORY_I18N[cat].title)}
                <span className="afx-num text-xs text-ink-3">{n}</span>
              </a>
            );
          })}
        </nav>
      </section>

      <div className="afx-motif-stripe h-2" />

      {/* Catalogues par catégorie */}
      {CATALOG_CATEGORIES.map((cat) => {
        const style = CATEGORY_STYLE[cat];
        const Icon = style.icon;
        const rows = catalogs.filter((c) => c.category === cat);
        return (
          <section key={cat} id={style.anchor} className="container px-6 md:px-12 py-12 scroll-mt-20">
            <div className="flex flex-col gap-2 mb-6 max-w-2xl">
              <h2 className="afx-h2 text-ink">{t(CATALOG_CATEGORY_I18N[cat].title)}</h2>
              <p className="text-ink-2 leading-relaxed">{t(CATALOG_CATEGORY_I18N[cat].desc)}</p>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-2 bg-surface px-6 py-10 text-center text-sm text-ink-3">
                {t("pcat.empty")}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((c) => (
                  <article
                    key={c.id}
                    className="group flex flex-col rounded-2xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-brand-md"
                  >
                    <a
                      href={`/api/catalogue/${c.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${t("pcat.view")} — ${c.title}`}
                      className={`block h-[200px] relative overflow-hidden ${style.motif}`}
                    >
                      {c.hasCover ? (
                        <Image
                          src={`/api/catalogue/${c.id}/cover`}
                          alt=""
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <Icon className="absolute right-5 bottom-5 h-14 w-14 text-mint-3/70" />
                      )}
                    </a>
                    <div className="p-5 flex flex-col gap-3 flex-1">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-tight text-ink leading-snug">{c.title}</h3>
                        {c.description && (
                          <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{c.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-ink-3 inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> PDF
                        {c.fileSize ? ` · ${formatFileSize(c.fileSize)}` : ""}
                      </div>
                      <div className="flex gap-2 mt-auto pt-1">
                        <Button asChild variant="outline" size="sm" className="rounded-full border-line-2 flex-1">
                          <a href={`/api/catalogue/${c.id}/file`} target="_blank" rel="noopener noreferrer">
                            {t("pcat.view")}
                          </a>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          className="rounded-full bg-night text-white hover:bg-night-2 flex-1"
                        >
                          <Link href={`/dashboard/catalogue/order?catalog=${c.id}`}>
                            <ShoppingBag className="h-4 w-4" /> {t("pcat.order")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Comment commander */}
      <section className="afx-surface-night px-6 md:px-12 py-14 mt-6">
        <div className="container grid md:grid-cols-3 gap-6">
          {HOW_KEYS.map((key, i) => (
            <div key={key} className="flex items-start gap-4">
              <span className="afx-num text-4xl text-mint leading-none">{i + 1}</span>
              <span className="text-lg font-semibold text-white leading-snug pt-1">{t(key)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
