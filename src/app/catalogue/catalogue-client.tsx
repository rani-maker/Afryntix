"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, FileText, Lamp, LayoutGrid, ShoppingBag, Sofa } from "lucide-react";
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
import { useCatalogCart } from "@/lib/catalog-cart";

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
  CARREAUX: { icon: LayoutGrid, motif: "afx-motif-bg bg-mint-pale", anchor: "carreaux" },
  DECO_LUMINAIRE: { icon: Lamp, motif: "afx-motif-diamond bg-surface-3", anchor: "deco-luminaire" },
  MEUBLE: { icon: Sofa, motif: "afx-motif-bg bg-surface-2", anchor: "meuble" },
};

const HOW_KEYS: TKey[] = ["pcat.how.1", "pcat.how.2", "pcat.how.3"];

/** Rayon du catalogue d'articles à prix affichés (/catalogue/produits), présenté en tête de page. */
export type ShopEntry = { family: CatalogCategoryKey; slug: string; count: number; image: string };

export function CataloguePublicClient({ catalogs, shop }: { catalogs: PublicCatalog[]; shop: ShopEntry[] }) {
  const { t } = useLang();
  const cartCount = useCatalogCart().items.length;

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
            <Link href="/catalogue/panier">
              <ShoppingBag className="h-4 w-4 mr-1" />
              {t("pcat.cta")}
              {cartCount > 0 && (
                <span className="afx-num ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-night px-1.5 text-xs text-white">
                  {cartCount}
                </span>
              )}
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

      {/* Articles à prix affichés */}
      {shop.length > 0 && (
        <section id="prix-affiches" className="container px-6 md:px-12 pt-12 scroll-mt-20">
          <div className="rounded-3xl border border-line bg-surface p-5 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="flex max-w-2xl flex-col gap-2">
                <span className="afx-kicker">{t("pshop.entry.kicker")}</span>
                <h2 className="afx-h2 text-ink">{t("pshop.entry.title")}</h2>
                <p className="leading-relaxed text-ink-2">{t("pshop.entry.desc")}</p>
              </div>
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-mint px-6 text-[15px] font-semibold text-[#0a0e0d] hover:bg-mint-2"
              >
                <Link href="/catalogue/produits">
                  {t("pshop.entry.cta")} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {shop.map((entry) => {
                const Icon = CATEGORY_STYLE[entry.family].icon;
                return (
                  <Link
                    key={entry.family}
                    href={`/catalogue/produits?famille=${entry.slug}`}
                    className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface-2 pr-4 transition-colors hover:border-mint-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.image}
                      alt=""
                      loading="lazy"
                      className="h-28 w-28 shrink-0 bg-[#f3f5f4] object-cover transition-transform duration-500 group-hover:scale-105 sm:h-32 sm:w-32"
                    />
                    <div className="min-w-0 flex-1 py-3">
                      <div className="flex items-center gap-2 text-[18px] font-bold tracking-tight text-ink">
                        <Icon className="h-4 w-4 shrink-0 text-mint-3" />
                        {t(CATALOG_CATEGORY_I18N[entry.family].title)}
                      </div>
                      <div className="mt-1 text-sm text-ink-2">
                        <span className="afx-num text-ink">{entry.count}</span> {t("pshop.count.many")}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-mint-3" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
                      href={`/catalogue/${c.id}`}
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
                        {c.description && <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{c.description}</p>}
                      </div>
                      <div className="text-xs text-ink-3 inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> PDF
                        {c.fileSize ? ` · ${formatFileSize(c.fileSize)}` : ""}
                      </div>
                      <div className="flex gap-2 mt-auto pt-1">
                        <Button
                          asChild
                          size="sm"
                          className="rounded-full bg-mint text-[#0a0e0d] hover:bg-mint-2 flex-1 h-11 font-semibold"
                        >
                          <Link href={`/catalogue/${c.id}`}>
                            <ShoppingBag className="h-4 w-4" /> {t("pcat.viewOrder")}
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
