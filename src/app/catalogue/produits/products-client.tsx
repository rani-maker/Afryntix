"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Bath, Check, Lamp, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";
import { useShopProductName } from "@/components/catalogues/use-shop-product-name";
import { useCatalogCart } from "@/lib/catalog-cart";
import { CATALOG_CATEGORY_I18N } from "@/lib/catalog-labels";
import {
  SHOP_CATEGORIES,
  SHOP_FAMILIES,
  SHOP_PRODUCTS,
  getShopProduct,
  shopCategoryKey,
  shopImageUrl,
  type ShopFamily,
  type ShopProduct,
} from "@/lib/shop-products";
import { formatXOF } from "@/lib/utils";

// Articles affichés d'un coup ; la suite arrive en approchant du bas de la liste
const PAGE_SIZE = 48;
const MAX_PER_ADD = 999;

const FAMILY_STYLE: Record<ShopFamily, { icon: typeof Bath; slug: string }> = {
  SANITAIRE: { icon: Bath, slug: "sanitaire" },
  DECO_LUMINAIRE: { icon: Lamp, slug: "luminaires" },
};

type Sort = "ref" | "asc" | "desc";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const chip =
  "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors md:h-9 md:px-3.5";
const chipOn = "border-mint bg-mint text-[#0a0e0d]";
const chipOff = "border-line-2 bg-surface text-ink-2 hover:border-mint-3 hover:text-ink";
const stepButton =
  "inline-flex h-10 w-9 items-center justify-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30";

function Stepper({
  value,
  onChange,
  labels,
}: {
  value: number;
  onChange: (delta: number) => void;
  labels: { less: string; more: string; quantity: string };
}) {
  return (
    <div className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-line-2 bg-surface">
      <button
        type="button"
        className={stepButton}
        disabled={value <= 1}
        onClick={() => onChange(-1)}
        aria-label={labels.less}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <output className="afx-num min-w-6 text-center text-sm text-ink" aria-label={labels.quantity}>
        {value}
      </output>
      <button
        type="button"
        className={stepButton}
        disabled={value >= MAX_PER_ADD}
        onClick={() => onChange(1)}
        aria-label={labels.more}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ProductsClient({
  initialFamily,
  initialCategory,
  initialRef,
}: {
  initialFamily: ShopFamily;
  initialCategory: string | null;
  initialRef: string | null;
}) {
  const { t } = useLang();
  const cart = useCatalogCart();

  const [family, setFamily] = useState(initialFamily);
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("ref");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openRef, setOpenRef] = useState(initialRef);
  // Quantité choisie sur chaque fiche avant l'ajout
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [cartFull, setCartFull] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const nameOf = useShopProductName();

  const inCart = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart.items) if (item.kind === "product") map.set(item.ref, item.quantity);
    return map;
  }, [cart.items]);

  const list = useMemo(() => {
    const q = fold(query.trim());
    // Une recherche porte sur tout le catalogue, pas seulement sur le rayon ouvert
    const rows = SHOP_PRODUCTS.filter((p) =>
      q
        ? fold(p.ref).includes(q) || fold(nameOf(p)).includes(q)
        : p.family === family && (!category || p.cat === category),
    );
    if (sort === "ref") return rows;
    return [...rows].sort((a, b) => (sort === "asc" ? a.price - b.price : b.price - a.price));
  }, [query, family, category, sort, nameOf]);

  const visible = list.slice(0, shown);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || shown >= list.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE_SIZE);
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, list.length]);

  // L'adresse suit le rayon ouvert : elle se partage et survit à un rechargement
  useEffect(() => {
    const params = new URLSearchParams();
    if (family !== "SANITAIRE" || category) params.set("famille", FAMILY_STYLE[family].slug);
    if (category) params.set("cat", category);
    if (openRef) params.set("ref", openRef);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [family, category, openRef]);

  function pickFamily(next: ShopFamily) {
    setFamily(next);
    setCategory(null);
    setQuery("");
    setShown(PAGE_SIZE);
  }
  function pickCategory(next: string | null) {
    setCategory(next);
    setQuery("");
    setShown(PAGE_SIZE);
  }

  const quantityOf = (ref: string) => quantities[ref] ?? 1;
  const stepQuantity = (ref: string, delta: number) =>
    setQuantities((q) => ({ ...q, [ref]: Math.max(1, Math.min(MAX_PER_ADD, (q[ref] ?? 1) + delta)) }));

  function addToCart(p: ShopProduct) {
    if (!cart.addProduct(p.ref, quantityOf(p.ref))) {
      setCartFull(true);
      return;
    }
    setCartFull(false);
    setQuantities((q) => ({ ...q, [p.ref]: 1 }));
    setJustAdded(p.ref);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(null), 1600);
  }
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const stepLabels = { less: t("pcat.viewer.less"), more: t("pcat.viewer.more"), quantity: t("pcat.viewer.quantity") };
  const cartCount = cart.items.length;
  const categories = SHOP_CATEGORIES.filter((c) => c.family === family);
  const familyCount = (f: ShopFamily) => SHOP_CATEGORIES.reduce((n, c) => n + (c.family === f ? c.count : 0), 0);
  const opened = getShopProduct(openRef);

  const addButton = (p: ShopProduct, className: string) => (
    <button
      type="button"
      onClick={() => addToCart(p)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-mint font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2 ${className}`}
    >
      {justAdded === p.ref ? (
        <>
          <Check className="h-4 w-4" /> {t("pshop.added")}
        </>
      ) : (
        <>
          <ShoppingBag className="h-4 w-4" /> {t("pshop.add")}
        </>
      )}
    </button>
  );

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/catalogue" />

      <section className="container px-4 pb-5 pt-6 sm:px-6 md:px-12 md:pb-6 md:pt-14">
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {t("pshop.entry.back")}
        </Link>
        <div className="mt-3 grid items-end gap-6 md:mt-4 lg:grid-cols-[1fr_auto]">
          <div className="flex max-w-3xl flex-col gap-3 md:gap-4">
            <span className="afx-kicker">{t("pshop.kicker")}</span>
            <h1 className="afx-h1">
              {t("pshop.title")}
              <br />
              <span className="italic text-mint-3">{t("pshop.title.accent")}</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-2 md:text-lg">{t("pshop.lead")}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              <li className="inline-flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full bg-mint" /> {t("pshop.legend.price")}
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full bg-ink-4" /> {t("pshop.legend.freight")}
              </li>
            </ul>
          </div>
          <Link
            href="/catalogue/panier"
            className="hidden h-12 items-center justify-center gap-2 rounded-full bg-mint px-6 text-[15px] font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2 lg:inline-flex"
          >
            <ShoppingBag className="h-4 w-4" />
            {t("pcat.cta")}
            {cartCount > 0 && (
              <span className="afx-num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-night px-1.5 text-xs text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </section>

      {/* Rayons : reste visible pendant le défilement */}
      <div className="sticky top-16 z-30 border-y border-line bg-[var(--afx-bg)]/95 backdrop-blur-md">
        <div className="container space-y-2 px-4 py-2.5 sm:px-6 md:px-12">
          <div className="flex gap-2" role="group" aria-label="Familles">
            {SHOP_FAMILIES.map((f) => {
              const Icon = FAMILY_STYLE[f].icon;
              const on = f === family && !query;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickFamily(f)}
                  className={`${chip} h-11 font-semibold md:h-10 ${on ? chipOn : chipOff}`}
                >
                  <Icon className={`h-4 w-4 ${on ? "" : "text-mint-3"}`} />
                  {t(CATALOG_CATEGORY_I18N[f].title)}
                  <span className={`afx-num text-xs ${on ? "opacity-70" : "text-ink-3"}`}>{familyCount(f)}</span>
                </button>
              );
            })}
          </div>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Catégories"
          >
            <button
              type="button"
              aria-pressed={!category && !query}
              onClick={() => pickCategory(null)}
              className={`${chip} ${!category && !query ? chipOn : chipOff}`}
            >
              {t("pshop.all")}
              <span className={`afx-num text-xs ${!category && !query ? "opacity-70" : "text-ink-3"}`}>
                {familyCount(family)}
              </span>
            </button>
            {categories.map((c) => {
              const on = c.code === category && !query;
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickCategory(c.code)}
                  className={`${chip} ${on ? chipOn : chipOff}`}
                >
                  {t(shopCategoryKey(c.code))}
                  <span className={`afx-num text-xs ${on ? "opacity-70" : "text-ink-3"}`}>{c.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="container px-4 pb-28 pt-5 sm:px-6 md:px-12">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder={t("pshop.search")}
              aria-label={t("pshop.search")}
              className="h-11 w-full rounded-full border border-line-2 bg-surface pl-11 pr-4 text-base text-ink outline-none placeholder:text-ink-4 focus:border-mint-3"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label={t("pshop.sort")}
            className="h-11 rounded-full border border-line-2 bg-surface px-4 text-sm font-medium text-ink outline-none focus:border-mint-3"
          >
            <option value="ref">{t("pshop.sort.ref")}</option>
            <option value="asc">{t("pshop.sort.asc")}</option>
            <option value="desc">{t("pshop.sort.desc")}</option>
          </select>
          <span className="ml-auto text-sm text-ink-3" aria-live="polite">
            <span className="afx-num text-ink">{list.length}</span>{" "}
            {list.length > 1 ? t("pshop.count.many") : t("pshop.count.one")}
          </span>
        </div>

        {cartFull && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {t("pcat.viewer.cartFull")}{" "}
            <Link href="/catalogue/panier" className="font-semibold underline underline-offset-4">
              {t("pcat.viewer.viewCart")}
            </Link>
          </p>
        )}

        {list.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line-2 bg-surface px-6 py-12 text-center text-sm text-ink-3">
            {t("pshop.empty")}
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => {
              const name = nameOf(p);
              const count = inCart.get(p.ref);
              return (
                <li
                  key={p.ref}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-brand-md"
                >
                  <button
                    type="button"
                    onClick={() => setOpenRef(p.ref)}
                    aria-label={`${t("pshop.zoom")} — ${name}`}
                    className="relative block aspect-square w-full cursor-zoom-in bg-[#f3f5f4] sm:aspect-[4/5]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopImageUrl(p.ref, "thumb")}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {count != null && (
                      <span className="afx-num absolute left-2 top-2 rounded-full bg-mint px-2.5 py-1 text-xs text-[#0a0e0d]">
                        × {count} {t("pshop.inCart")}
                      </span>
                    )}
                    {p.eco && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-night/80 px-2.5 py-1 text-[11px] font-medium text-white">
                        {t("pshop.eco")}
                      </span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div>
                      <div className="font-mono text-[11px] tracking-wide text-ink-3">{p.ref}</div>
                      <h2 className="mt-0.5 text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                        {name}
                      </h2>
                    </div>
                    <dl className="mt-auto space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <dt className="text-xs text-ink-3">{t("pshop.price")}</dt>
                        <dd className="afx-num text-[17px] text-ink">{formatXOF(p.price)}</dd>
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <dt className="text-xs text-ink-3">{t("pshop.freight")}</dt>
                        <dd className="afx-num text-sm text-ink-2">{formatXOF(p.freight)}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <Stepper value={quantityOf(p.ref)} onChange={(d) => stepQuantity(p.ref, d)} labels={stepLabels} />
                      {addButton(p, "h-10 min-w-0 flex-1 basis-24 px-3 text-sm")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {shown < list.length && (
          <div ref={sentinel} className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="inline-flex h-11 items-center rounded-full border border-line-2 bg-surface px-6 text-sm font-medium text-ink hover:border-mint-3"
            >
              {t("pshop.more")}
            </button>
          </div>
        )}

        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ink-3">{t("pshop.note")}</p>
      </section>

      {cartCount > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
          <Link
            href="/catalogue/panier"
            className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-night px-5 text-[15px] font-semibold text-white shadow-brand-md transition-colors hover:bg-night-2"
          >
            <ShoppingBag className="h-4 w-4 text-mint" />
            {t("pcat.viewer.viewCart")}
            <span className="afx-num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-mint px-1.5 text-xs text-[#0a0e0d]">
              {cartCount}
            </span>
          </Link>
        </div>
      )}

      <Dialog.Root open={!!opened} onOpenChange={(open) => !open && setOpenRef(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-night/70 backdrop-blur-sm" />
          {opened && (
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-brand-md outline-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[90dvh] md:w-[min(920px,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-3xl"
            >
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f3f5f4] md:basis-3/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopImageUrl(opened.ref)}
                  alt={nameOf(opened)}
                  className="max-h-[52dvh] w-full object-contain md:max-h-[90dvh]"
                />
              </div>
              <div className="flex flex-col gap-4 p-5 md:basis-2/5 md:justify-center md:p-7">
                <div>
                  <div className="font-mono text-xs tracking-wide text-ink-3">{opened.ref}</div>
                  <Dialog.Title className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">
                    {nameOf(opened)}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-ink-3">
                    {t(CATALOG_CATEGORY_I18N[opened.family].title)}
                    {inCart.has(opened.ref) ? ` · × ${inCart.get(opened.ref)} ${t("pshop.inCart")}` : ""}
                  </p>
                </div>
                <dl className="space-y-2 rounded-2xl bg-surface-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-sm text-ink-2">{t("pshop.legend.price")}</dt>
                    <dd className="afx-num text-2xl text-ink">{formatXOF(opened.price)}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-sm text-ink-2">{t("pshop.freight")}</dt>
                    <dd className="afx-num text-base text-ink-2">{formatXOF(opened.freight)}</dd>
                  </div>
                </dl>
                <div className="flex gap-2">
                  <Stepper
                    value={quantityOf(opened.ref)}
                    onChange={(d) => stepQuantity(opened.ref, d)}
                    labels={stepLabels}
                  />
                  {addButton(opened, "h-12 flex-1 px-5 text-[15px]")}
                </div>
                {cartFull && <p className="text-sm text-amber-700">{t("pcat.viewer.cartFull")}</p>}
                <p className="text-xs leading-relaxed text-ink-3">{t("pshop.note")}</p>
              </div>
              <Dialog.Close
                aria-label={t("pcat.viewer.close")}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-night/70 text-white transition-colors hover:bg-night"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
