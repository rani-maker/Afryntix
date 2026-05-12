import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Adresses des entrepôts",
  description:
    "Adresses AFRYNTIX en Chine (Guangzhou, Foshan) et en Côte d'Ivoire (Abidjan). Envoyez vos colis directement à nos entrepôts en Chine.",
  openGraph: {
    title: "Adresses des entrepôts | AFRYNTIX",
    description:
      "Adresses AFRYNTIX en Chine (Guangzhou, Foshan) et en Côte d'Ivoire (Abidjan). Envoyez vos colis directement à nos entrepôts en Chine.",
    url: "/addresses",
    images: [{ url: "/images/entrepot.jpg", width: 1200, height: 630, alt: "Entrepôts AFRYNTIX" }],
  },
  alternates: { canonical: "/addresses" },
};
import {
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  Building2,
  Plane,
  Ship,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";

const TYPE_META: Record<string, { label: string; kicker: string; icon: typeof Plane }> = {
  AIR_WAREHOUSE:  { label: "Entrepôt aérien (Chine)",   kicker: "FRET AÉRIEN · 空运仓库",  icon: Plane     },
  SEA_WAREHOUSE:  { label: "Entrepôt maritime (Chine)",  kicker: "FRET MARITIME · 海运仓库", icon: Ship      },
  RECEPTION:      { label: "Réception (Afrique)",        kicker: "RETRAIT EN AO",            icon: Building2 },
  OFFICE:         { label: "Bureau",                     kicker: "BUREAU",                   icon: Briefcase },
};

const GROUP_ORDER = ["AIR_WAREHOUSE", "SEA_WAREHOUSE", "RECEPTION", "OFFICE"] as const;

const SHIPPING_MARK_LINES = [
  { label: "NOM",              hint: "Votre nom complet" },
  { label: "NUMÉRO",           hint: "Votre numéro WhatsApp" },
  { label: "Adresse",          hint: "Ville / pays de livraison" },
  { label: "Natures du Colis", hint: "Ex : vêtements, électronique…" },
  { label: "Mode d'Envoi",     hint: "Aérien / Maritime" },
];

const STATIC_ADDRESSES = [
  {
    id: "static-sea",
    type: "SEA_WAREHOUSE",
    label: "Entrepôt Maritime — Foshan 佛山",
    contactName: "仓库赖先生 (Lai)",
    phone: "+8615915702055",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广东省佛山市南海区里水镇岗联工业区兴业路2号A仓 A656",
    line2: "八方仓储园 — 入仓号 / Entry code : AFRYNTIX",
    postalCode: null,
    city: "Foshan 佛山",
    country: "Chine",
    notes: "Maritime uniquement : ajouter 入仓号 AFRYNTIX + NOM + TÉLÉPHONE sur le colis. Joindre un bon de commande en chinois (装箱单). Tout colis sans code d'entrée sera refusé.",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-air",
    type: "AIR_WAREHOUSE",
    label: "Entrepôt Aérien — Guangzhou 广州",
    contactName: "Afryntix GZ",
    phone: "+8619066500468",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
    line2: null,
    postalCode: null,
    city: "Guangzhou 广州",
    country: "Chine",
    notes: "Coller le Shipping Mark COMPLET sur chaque colis (NOM, NUMÉRO, Adresse, Nature, Mode). Colis sans Shipping Mark = refusé.",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-office-cn",
    type: "OFFICE",
    label: "Bureau AFRYNTIX — Guangzhou 广州",
    contactName: "Afryntix Chine",
    phone: "+8619066500468",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
    line2: null,
    postalCode: null,
    city: "Guangzhou 广州",
    country: "Chine",
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-office-abj",
    type: "OFFICE",
    label: "Bureau AFRYNTIX — Abidjan",
    contactName: "Afryntix Abidjan",
    phone: "+2250706260405",
    whatsapp: "+2250706260405",
    email: null,
    line1: "Angré Château",
    line2: "À 250 m du commissariat du 40ème Arr.",
    postalCode: null,
    city: "Abidjan",
    country: "Côte d'Ivoire",
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default async function PublicAddressesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let addresses: any[] = STATIC_ADDRESSES;
  try {
    const dbAddresses = await prisma.companyAddress.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
    if (dbAddresses.length > 0) addresses = dbAddresses;
  } catch {
    // DB non configurée — adresses statiques
  }

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: addresses.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/addresses" />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden isolate">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <Image src="/images/banner-1.jpg" alt="" fill priority sizes="100vw"
            className="object-cover opacity-60" />
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80" />
        </div>
        <div className="container px-6 md:px-12 pt-16 pb-10 relative">
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div className="flex flex-col gap-4 max-w-3xl">
              <span className="afx-kicker">地址 · ADRESSES & SHIPPING MARK</span>
              <h1 className="afx-h1">
                Nos <span className="italic text-mint-3">adresses</span>
                <br />de réception.
              </h1>
              <p className="text-lg text-ink-2 leading-relaxed max-w-[560px]">
                Faites livrer vos colis à nos entrepôts selon le mode de transport
                choisi. Nos équipes réceptionnent, consolident et expédient.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="afx-motif-stripe h-2" />

      {/* ── Avertissement ────────────────────────────────── */}
      <section className="afx-surface-night py-10 px-6 md:px-12">
        <div className="container flex flex-col md:flex-row items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-mint/15 text-mint grid place-items-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-display text-xl font-bold text-white leading-snug">
              Tout colis sans Shipping Mark sera refusé à l&apos;entrepôt
            </p>
            <p className="text-white/70 text-[15px] leading-relaxed">
              Chaque colis doit porter l&apos;étiquette <strong className="text-mint">SHIPPING MARK</strong> avec
              votre nom, numéro WhatsApp, adresse de livraison, nature du colis et mode d&apos;envoi —
              collée ou écrite lisiblement sur l&apos;emballage extérieur.
            </p>
            <p className="text-mint/80 text-sm font-medium mt-1">
              亲！务必在外包装写明入仓号和客人的名字和电话！没有入仓号仓库拒收货物！
            </p>
          </div>
        </div>
      </section>

      {/* ── Shipping Mark Template ────────────────────────── */}
      <section className="container px-6 md:px-12 py-12">
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">
          <div className="flex flex-col gap-3">
            <span className="afx-kicker">🏷️ MODÈLE D&apos;ÉTIQUETTE · SHIPPING MARK</span>
            <h2 className="afx-h2">À coller sur chaque colis.</h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-md">
              Imprimez ou écrivez ces informations et collez-les sur l&apos;emballage
              extérieur de chaque colis avant l&apos;envoi à l&apos;entrepôt.
            </p>
            {/* Note maritime */}
            <div className="mt-2 rounded-xl border border-line bg-surface-2 px-5 py-4 flex items-start gap-3">
              <Ship className="h-4 w-4 text-mint-3 shrink-0 mt-0.5" />
              <p className="text-[13px] text-ink-2 leading-relaxed">
                <span className="font-semibold text-ink">Maritime uniquement :</span> ajouter{" "}
                <span className="font-mono font-bold text-mint-3 bg-mint-soft px-1.5 py-0.5 rounded text-[12px]">
                  入仓号 : AFRYNTIX
                </span>{" "}
                sur le colis et joindre un bon de commande en chinois (装箱单) à l&apos;extérieur.
              </p>
            </div>
          </div>

          {/* Label visuel */}
          <div className="rounded-2xl border border-line bg-surface shadow-brand-md overflow-hidden">
            <div className="afx-motif-stripe h-1.5" />
            <div className="p-6 flex flex-col gap-3">
              <div className="text-center pb-4 border-b border-line">
                <div className="font-display text-2xl font-black tracking-widest text-ink">
                  AFRYNTIX
                </div>
                <div className="text-[11px] text-ink-3 mt-0.5 uppercase tracking-widest">
                  Transport &amp; Logistique Chine — Afrique de l&apos;Ouest
                </div>
              </div>
              {SHIPPING_MARK_LINES.map(({ label, hint }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-ink w-36 shrink-0">{label} :</span>
                  <span className="text-[13px] text-ink-3 border-b border-line flex-1 pb-0.5">
                    {hint}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-ink-3 pt-2 border-t border-line text-center">
                Reproduire sur chaque colis du même envoi
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="afx-motif-stripe h-1 opacity-40" />

      {/* ── Adresses ─────────────────────────────────────── */}
      <section className="container px-6 md:px-12 py-12 flex flex-col gap-14">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <MapPin className="h-8 w-8 text-mint-3 mx-auto mb-3" />
            <p className="text-ink-2">
              Aucune adresse publiée pour l&apos;instant. Contactez-nous via WhatsApp.
            </p>
          </div>
        ) : (
          grouped.map((g) => {
            const meta = TYPE_META[g.type];
            const Icon = meta.icon;
            return (
              <div key={g.type} className="flex flex-col gap-5">
                {/* Section header */}
                <div className="flex items-end justify-between flex-wrap gap-3 pb-3 border-b border-line">
                  <div className="flex flex-col gap-1.5">
                    <span className="afx-kicker">{meta.kicker}</span>
                    <h2 className="font-display text-3xl md:text-[38px] font-semibold tracking-tight leading-tight">
                      {meta.label}
                    </h2>
                  </div>
                  <span className="text-[13px] text-ink-3">
                    {g.items.length} {g.items.length > 1 ? "adresses" : "adresse"}
                  </span>
                </div>

                {/* Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  {g.items.map((a) => (
                    <article
                      key={a.id}
                      className="rounded-2xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-brand-md flex flex-col"
                    >
                      {/* Top: icon + adresse */}
                      <div className="flex items-start gap-4 p-6">
                        <div className="w-11 h-11 rounded-xl bg-mint-soft text-mint-3 grid place-items-center shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[17px] font-bold text-ink tracking-tight leading-snug">
                            {a.label}
                          </div>
                          <div className="text-[13px] text-ink-2 mt-2 leading-relaxed space-y-0.5">
                            <div>{a.line1}</div>
                            {a.line2 && (
                              <div className="font-semibold text-mint-3">{a.line2}</div>
                            )}
                            <div className="text-ink-3">
                              {[a.postalCode, a.city, a.country].filter(Boolean).join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact */}
                      {(a.contactName || a.phone || a.whatsapp || a.email) && (
                        <div className="border-t border-line bg-surface-2/50 px-6 py-4 flex flex-col gap-1.5">
                          {a.contactName && (
                            <div className="text-[13px] font-semibold text-ink">{a.contactName}</div>
                          )}
                          {a.phone && (
                            <a href={`tel:${a.phone}`}
                              className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-mint-3 transition-colors">
                              <Phone className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                              <span className="font-mono">{a.phone}</span>
                            </a>
                          )}
                          {a.whatsapp && a.whatsapp !== a.phone && (
                            <a href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-mint-3 transition-colors">
                              <MessageCircle className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
                              <span className="font-mono">{a.whatsapp}</span>
                            </a>
                          )}
                          {a.email && (
                            <a href={`mailto:${a.email}`}
                              className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-mint-3 transition-colors">
                              <Mail className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                              <span>{a.email}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Note */}
                      {a.notes && (
                        <div className="border-t border-line bg-surface-2/30 px-6 py-3 mt-auto">
                          <p className="text-[12px] text-ink-3 leading-relaxed">
                            <span className="font-semibold text-ink-2">⚠️ </span>
                            {a.notes}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Footer bar ───────────────────────────────────── */}
      <footer className="border-t border-line bg-surface-2/60 px-6 md:px-12 py-8 mt-4">
        <div className="container flex flex-wrap items-center justify-between gap-4">
          <span className="text-[13px] text-ink-3">
            © {new Date().getFullYear()} AFRYNTIX SAS · Transport &amp; Logistique Chine – Afrique de l&apos;Ouest
          </span>
          <div className="flex items-center gap-4 text-[13px] text-ink-3">
            <a href="tel:+2250706260405" className="hover:text-mint-3 transition-colors">
              +225 0706260405
            </a>
            <span>·</span>
            <a href="tel:+8619066500468" className="hover:text-mint-3 transition-colors">
              +86 190 6650 0468
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
