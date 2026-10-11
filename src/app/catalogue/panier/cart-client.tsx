"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";
import { useCatalogCart, useSentRequests } from "@/lib/catalog-cart";
import { createCartOrder } from "@/server/actions/catalog-cart";

type Sent = { reference: string; trackPath: string | null; whatsappUrl: string | null; hasAccount: boolean };

const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-mint px-6 text-[15px] font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2 disabled:opacity-60";
const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-2 bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:border-mint-3";

export function CartClient({
  account,
  isTeam,
}: {
  account: { phone: string; city: string } | null;
  isTeam: boolean;
}) {
  const { t } = useLang();
  const cart = useCatalogCart();
  const sent = useSentRequests();
  // Le panier vit dans le navigateur : on attend le montage pour ne pas afficher « vide » à tort
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [city, setCity] = useState(account?.city ?? "");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Sent | null>(null);

  const setQuantity = (key: string, value: number) =>
    cart.update(key, { quantity: Math.max(1, Math.min(100000, Math.round(value) || 1)) });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let res: Awaited<ReturnType<typeof createCartOrder>>;
    try {
      res = await createCartOrder({
        items: cart.items.map(({ catalogId, page, x, y, quantity, note, thumb }) => ({
          catalogId,
          page,
          x,
          y,
          quantity,
          note,
          thumb,
        })),
        name,
        contactPhone: phone,
        email,
        deliveryCity: city,
        notes,
        website,
      });
    } catch {
      res = { success: false, error: "Envoi impossible. Vérifiez votre connexion et réessayez." };
    }
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.success ? "Envoi impossible. Réessayez." : res.error);
      return;
    }
    if (!res.data.hasAccount && res.data.trackPath) {
      sent.remember({ reference: res.data.reference, url: res.data.trackPath, sentAt: new Date().toISOString() });
    }
    cart.clear();
    setDone(res.data);
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/catalogue" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        {done ? (
          <section className="rounded-2xl border border-line bg-surface p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-mint-3" />
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">{t("pcat.cart.sentTitle")}</h1>
            <p className="mt-2 text-ink-2">{t("pcat.cart.sentBody")}</p>
            <p className="afx-num mt-1 text-lg text-ink">{done.reference}</p>
            {!done.hasAccount && done.trackPath && <p className="mt-3 text-sm text-ink-3">{t("pcat.cart.keepLink")}</p>}
            <div className="mt-5 flex flex-col gap-2">
              {done.trackPath && (
                <Link href={done.trackPath} className={primaryButton}>
                  {done.hasAccount ? t("pcat.cart.orders") : t("pcat.cart.track")} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {done.whatsappUrl && (
                <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                  {t("pcat.cart.whatsapp")}
                </a>
              )}
              <Link href="/catalogue" className="mt-1 text-sm text-ink-3 underline underline-offset-4 hover:text-ink">
                {t("pcat.cart.browse")}
              </Link>
            </div>
          </section>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t("pcat.cart.title")}</h1>
            {!mounted ? (
              <div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface-2" />
            ) : cart.items.length === 0 ? (
              <section className="mt-6 rounded-2xl border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-ink-4" />
                <p className="mt-3 font-semibold text-ink">{t("pcat.cart.empty")}</p>
                <p className="mt-1 text-sm text-ink-3">{t("pcat.cart.emptyHint")}</p>
                <Link href="/catalogue" className={`${primaryButton} mt-5`}>
                  {t("pcat.cart.browse")} <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            ) : (
              <form onSubmit={handleSubmit} className="mt-2 space-y-5">
                <p className="text-ink-2">{t("pcat.cart.lead")}</p>

                <ul className="space-y-3">
                  {cart.items.map((item) => (
                    <li key={item.key} className="rounded-2xl border border-line bg-surface p-3">
                      <div className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumb}
                          alt=""
                          className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-ink">{item.catalogTitle}</div>
                              <div className="text-xs text-ink-3">
                                {t("pcat.viewer.page")} {item.page}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => cart.remove(item.key)}
                              aria-label={t("pcat.cart.remove")}
                              title={t("pcat.cart.remove")}
                              className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQuantity(item.key, item.quantity - 1)}
                              aria-label={t("pcat.viewer.less")}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-ink hover:border-mint-3"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100000}
                              step={1}
                              required
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.key, Number(e.target.value))}
                              aria-label={t("pcat.viewer.quantity")}
                              className="afx-num h-10 w-20 rounded-xl border border-line-2 bg-transparent text-center text-base text-ink outline-none focus:border-mint-3"
                            />
                            <button
                              type="button"
                              onClick={() => setQuantity(item.key, item.quantity + 1)}
                              aria-label={t("pcat.viewer.more")}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-ink hover:border-mint-3"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <input
                        type="text"
                        maxLength={200}
                        value={item.note}
                        onChange={(e) => cart.update(item.key, { note: e.target.value })}
                        placeholder={t("pcat.viewer.note")}
                        aria-label={t("pcat.viewer.note")}
                        className="mt-3 h-10 w-full rounded-xl border border-line-2 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-4 focus:border-mint-3"
                      />
                    </li>
                  ))}
                </ul>

                <Link
                  href="/catalogue"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-mint-3 hover:underline"
                >
                  <Plus className="h-4 w-4" /> {t("pcat.cart.addMore")}
                </Link>

                {isTeam ? (
                  <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                    {t("pcat.cart.teamNotice")}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {!account && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="cart-name">{t("pcat.cart.name")} *</Label>
                          <Input
                            id="cart-name"
                            required
                            minLength={2}
                            maxLength={120}
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-12 text-base"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="cart-phone">
                          {t("pcat.cart.phone")}
                          {!account && " *"}
                        </Label>
                        <Input
                          id="cart-phone"
                          type="tel"
                          inputMode="tel"
                          required={!account}
                          maxLength={40}
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+225 07 00 00 00 00"
                          className="h-12 text-base"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cart-city">{t("pcat.cart.city")}</Label>
                        <Input
                          id="cart-city"
                          maxLength={80}
                          autoComplete="address-level2"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Abidjan, Dakar, Lomé…"
                          className="h-12 text-base"
                        />
                      </div>
                      {!account && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="cart-email">{t("pcat.cart.email")}</Label>
                          <Input
                            id="cart-email"
                            type="email"
                            inputMode="email"
                            maxLength={160}
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 text-base"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="cart-notes">{t("pcat.cart.message")}</Label>
                        <Textarea
                          id="cart-notes"
                          rows={2}
                          maxLength={2000}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="text-base"
                        />
                      </div>
                    </div>
                    {/* Champ piège pour les robots : invisible et hors tabulation */}
                    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                      <label>
                        Site web
                        <input
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                        />
                      </label>
                    </div>

                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <button type="submit" disabled={loading} className={`${primaryButton} w-full`}>
                      {loading ? t("pcat.cart.sending") : t("pcat.cart.send")}
                      {!loading && (
                        <span className="afx-num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0a0e0d] px-1.5 text-xs text-white">
                          {cart.items.length}
                        </span>
                      )}
                    </button>
                    <p className="text-center text-xs text-ink-3">{t("pcat.cart.noPrice")}</p>
                  </>
                )}
              </form>
            )}
          </>
        )}

        {mounted && !account && sent.requests.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-ink-2">{t("pcat.cart.previous")}</h2>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
              {sent.requests.map((r) => (
                <li key={r.reference}>
                  <Link href={r.url} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                    <span className="afx-num text-ink">{r.reference}</span>
                    <span className="inline-flex items-center gap-1 text-mint-3">
                      {t("pcat.cart.track")} <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
