"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Plane,
  Ship,
  Truck,
  Wrench,
  MapPin,
  Package,
  ArrowRight,
  MessageCircle,
  CreditCard,
  Navigation,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackingSearchForm } from "@/components/tracking/tracking-search-form";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";
import type { TKey } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useLang();
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/" />

      {/* HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden isolate">
        {/* Slow-pan two-image background carousel */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="afx-banner-track">
            <div>
              <Image
                src="/images/banner-1.jpg"
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover opacity-60"
              />
            </div>
            <div>
              <Image
                src="/images/banner-2.jpg"
                alt=""
                fill
                sizes="100vw"
                className="object-cover opacity-60"
              />
            </div>
          </div>
          {/* Readability overlay */}
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80" />
        </div>

        <div className="container grid lg:grid-cols-[1fr_420px] gap-12 px-6 md:px-12 pt-16 pb-12 relative">
          <div className="flex flex-col gap-6 pt-3">
            <span className="afx-kicker">{t("home.kicker")}</span>
            <h1 className="afx-h0">
              {t("home.title.bridge")}
              <br />
              <span className="italic text-mint-3">{t("home.title.china")}</span>{" "}
              <span className="font-cn text-ink-3 text-[0.75em]">↔</span>{" "}
              <span className="italic">{t("home.title.westafrica")}</span>
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed max-w-[540px]">
              {t("home.lead")}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-mint text-ink hover:bg-mint-2 h-12 px-6 text-[15px] font-semibold"
              >
                <Link href="/register">
                  {t("home.cta.quote")} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-line-2 h-12 px-6 text-[15px] font-semibold"
              >
                <Link href="/services">{t("home.cta.services")}</Link>
              </Button>
            </div>
            <div className="flex items-center gap-7 mt-4">
              <div className="flex flex-col">
                <span className="afx-num text-[28px]">12 400+</span>
                <span className="text-[13px] text-ink-3">{t("home.kpi.parcels")}</span>
              </div>
              <div className="w-px h-8 bg-line-2" />
              <div className="flex flex-col">
                <span className="afx-num text-[28px]">96 %</span>
                <span className="text-[13px] text-ink-3">{t("home.kpi.ontime")}</span>
              </div>
              <div className="w-px h-8 bg-line-2" />
              <div className="flex flex-col">
                <span className="afx-num text-[28px]">{t("home.kpi.cities")}</span>
                <span className="text-[13px] text-ink-3">{t("home.kpi.cities.sub")}</span>
              </div>
            </div>
          </div>

          {/* Right column: visual card + tracking */}
          <div className="flex flex-col gap-4">
            <div className="relative h-[280px] rounded-2xl overflow-hidden flex items-end p-5 text-white">
              <Image
                src="/images/maritime-fcl.jpg"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-night/55 via-night/75 to-mint-3/40" />
              <div className="afx-motif-stripe absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
              <div className="relative">
                <span className="afx-kicker" style={{ color: "var(--afx-mint-soft)" }}>
                  {t("home.fleet.kicker")}
                </span>
                <div className="font-display text-2xl font-semibold mt-2 drop-shadow-md">
                  {t("home.fleet.title")}
                </div>
              </div>
              <div className="absolute top-5 right-5 flex items-center gap-2 text-white/80 text-xs">
                <Ship className="h-4 w-4" />
                <Plane className="h-4 w-4" />
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-brand-md">
              <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>
                {t("home.tracking.label")}
              </span>
              <div className="mt-3">
                <TrackingSearchForm />
              </div>
            </div>
          </div>
        </div>
        <div className="afx-motif-stripe h-2" />
      </section>

      {/* SERVICES ────────────────────────────────────────── */}
      <section className="container px-6 md:px-12 py-16 flex flex-col gap-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <span className="afx-kicker">{t("home.services.kicker")}</span>
            <h2 className="afx-h2 md:text-[56px]">{t("home.services.title")}</h2>
          </div>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-line-2 h-10"
          >
            <Link href="/services">
              {t("home.services.compare")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s, i) => (
            <ServiceCard
              key={i}
              icon={s.icon}
              name={t(s.nameKey)}
              sub={t(s.subKey)}
              desc={t(s.descKey)}
              motif={s.motif}
              image={s.image}
              moreLabel={t("home.services.more")}
            />
          ))}
        </div>
      </section>

      {/* PROCESS — night band ───────────────────────────── */}
      <section className="afx-surface-night py-14 px-6 md:px-12">
        <div className="container flex flex-wrap items-end justify-between gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <span className="afx-kicker" style={{ color: "var(--afx-mint-soft)" }}>
              {t("home.process.kicker")}
            </span>
            <h2 className="font-display text-4xl md:text-[48px] font-semibold text-white leading-[1.05] tracking-tight">
              {t("home.process.title")}
            </h2>
          </div>
          <span className="text-white/70 max-w-xs text-[15px]">
            {t("home.process.lead")}
          </span>
        </div>
        <div className="container grid md:grid-cols-4 gap-6">
          {STEPS.map(({ n, titleKey, descKey }, i) => (
            <div
              key={n}
              className={`flex flex-col gap-3 pr-6 ${
                i < 3 ? "md:border-r md:border-dashed md:border-white/15" : ""
              }`}
            >
              <span className="afx-num text-5xl text-mint">{n}</span>
              <div className="text-xl font-bold text-white tracking-tight">{t(titleKey)}</div>
              <span className="text-white/70 text-sm leading-relaxed">{t(descKey)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS + WHY ─────────────────────────────── */}
      <section className="container px-6 md:px-12 py-16 grid lg:grid-cols-[1fr_320px] gap-12">
        <div className="flex flex-col gap-4">
          <span className="afx-kicker">{t("home.testimonials.kicker")}</span>
          <h2 className="font-display text-4xl md:text-[40px] font-semibold leading-tight tracking-tight">
            {t("home.testimonials.title")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {TESTIMONIALS.map((tm, i) => (
              <Testimonial
                key={i}
                initials={tm.initials}
                name={tm.name}
                role={t(tm.roleKey)}
                quote={t(tm.quoteKey)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <span className="afx-kicker">{t("home.why.kicker")}</span>
          {WHY_US.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 py-3 ${
                i < WHY_US.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-mint-soft text-mint-3 grid place-items-center shrink-0">
                <w.icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-sm text-ink">{t(w.titleKey)}</span>
                <span className="text-[13px] text-ink-3">{t(w.descKey)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA ─────────────────────────────────────────────── */}
      <section className="container px-6 md:px-12 pb-16">
        <div className="afx-surface-mint rounded-3xl p-10 md:p-12 relative overflow-hidden text-[#0a0e0d]">
          <div className="afx-motif-diamond absolute inset-0 opacity-15" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-col gap-3">
              <span className="font-cn text-sm text-[#0a0e0d]/80">{t("home.cta.kicker")}</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
                {t("home.cta.title")}
              </h2>
              <span className="text-[#1c2624] text-base">
                {t("home.cta.lead")}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white text-mint-3 hover:bg-white/90 h-12 px-6 text-[15px] font-semibold"
              >
                <Link href="/register">
                  {t("home.cta.quote")} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[#0a0e0d]/40 bg-transparent text-[#0a0e0d] hover:bg-[#0a0e0d]/5 h-12 px-6 text-[15px] font-semibold"
              >
                <Link href="/addresses">{t("home.cta.call")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface-2/60 px-6 md:px-12 py-10">
        <div className="container flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <Logo variant="sm" tone="auto" className="h-9 w-auto" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              {FOOTER_COLS.map(({ titleKey, itemKeys }) => (
                <div key={titleKey} className="flex flex-col gap-2">
                  <span className="text-[11px] uppercase tracking-[0.04em] font-semibold text-ink-3">
                    {t(titleKey)}
                  </span>
                  {itemKeys.map((k) => (
                    <span key={k} className="text-[13px] text-ink-2">
                      {t(k)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bureaux ABJ + CN */}
          <div className="grid sm:grid-cols-2 gap-6 pt-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.04em] font-semibold text-mint-3">
                {t("footer.office.abj")}
              </span>
              <span className="text-[13px] text-ink-2">
                {t("footer.office.abj.address")}
              </span>
              <a
                href="tel:+2250706260405"
                className="text-[13px] text-ink-2 hover:text-mint-3 transition-colors"
              >
                {t("footer.office.abj.phone")}
              </a>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.04em] font-semibold text-mint-3">
                {t("footer.office.cn")}
              </span>
              <span className="text-[13px] text-ink-2">
                广州市越秀区环市西路202号桐舍酒店 3楼305G房
              </span>
              <a
                href="tel:+8619066500468"
                className="text-[13px] text-ink-2 hover:text-mint-3 transition-colors"
              >
                {t("footer.office.cn.phone")}
              </a>
            </div>
          </div>

          <div className="border-t border-line" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-ink-3">
              © {new Date().getFullYear()} AFRYNTIX SAS · {t("footer.copyright")}
            </span>
            <div className="flex items-center gap-3 text-[13px] text-ink-3">
              <span>FR · 中文</span>
              <span>XOF · CNY · €</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ── Data ─────────────────────────────────────────────────

type ServiceItem = {
  icon: typeof Package;
  nameKey: TKey;
  subKey: TKey;
  descKey: TKey;
  motif: "stripe" | "diamond" | "world" | "bg";
  image?: string;
};

const SERVICES: ReadonlyArray<ServiceItem> = [
  {
    icon: Plane,
    nameKey: "svc.air.name",
    subKey: "svc.air.sub",
    descKey: "svc.air.desc",
    motif: "stripe",
    image: "/images/express.jpg",
  },
  {
    icon: Ship,
    nameKey: "svc.lcl.name",
    subKey: "svc.lcl.sub",
    descKey: "svc.lcl.desc",
    motif: "diamond",
    image: "/images/maritime-lcl.jpg",
  },
  {
    icon: Ship,
    nameKey: "svc.fcl.name",
    subKey: "svc.fcl.sub",
    descKey: "svc.fcl.desc",
    motif: "world",
    image: "/images/maritime-fcl.jpg",
  },
  {
    icon: Truck,
    nameKey: "svc.veh.name",
    subKey: "svc.veh.sub",
    descKey: "svc.veh.desc",
    motif: "stripe",
    image: "/images/vehicule.jpg",
  },
  {
    icon: Wrench,
    nameKey: "svc.btp.name",
    subKey: "svc.btp.sub",
    descKey: "svc.btp.desc",
    motif: "diamond",
    image: "/images/engin-btp.avif",
  },
  {
    icon: MapPin,
    nameKey: "svc.stock.name",
    subKey: "svc.stock.sub",
    descKey: "svc.stock.desc",
    motif: "bg",
    image: "/images/entrepot.jpg",
  },
];

const STEPS: ReadonlyArray<{ n: string; titleKey: TKey; descKey: TKey }> = [
  { n: "01", titleKey: "home.step.1.title", descKey: "home.step.1.desc" },
  { n: "02", titleKey: "home.step.2.title", descKey: "home.step.2.desc" },
  { n: "03", titleKey: "home.step.3.title", descKey: "home.step.3.desc" },
  { n: "04", titleKey: "home.step.4.title", descKey: "home.step.4.desc" },
];

const TESTIMONIALS: ReadonlyArray<{
  initials: string;
  name: string;
  roleKey: TKey;
  quoteKey: TKey;
}> = [
  {
    initials: "AK",
    name: "Aïssata K.",
    roleKey: "home.test.1.role",
    quoteKey: "home.test.1.quote",
  },
  {
    initials: "CD",
    name: "Cheikh D.",
    roleKey: "home.test.2.role",
    quoteKey: "home.test.2.quote",
  },
];

const WHY_US: ReadonlyArray<{
  icon: typeof Package;
  titleKey: TKey;
  descKey: TKey;
}> = [
  { icon: Navigation, titleKey: "home.why.1.title", descKey: "home.why.1.desc" },
  { icon: MessageCircle, titleKey: "home.why.2.title", descKey: "home.why.2.desc" },
  { icon: CalendarCheck, titleKey: "home.why.3.title", descKey: "home.why.3.desc" },
  { icon: CreditCard, titleKey: "home.why.4.title", descKey: "home.why.4.desc" },
];

const FOOTER_COLS: ReadonlyArray<{ titleKey: TKey; itemKeys: ReadonlyArray<TKey> }> = [
  {
    titleKey: "footer.col.services",
    itemKeys: [
      "footer.services.air",
      "footer.services.sea",
      "footer.services.veh",
      "footer.services.btp",
      "footer.services.stock",
    ],
  },
  {
    titleKey: "footer.col.company",
    itemKeys: [
      "footer.company.about",
      "footer.company.addresses",
      "footer.company.careers",
      "footer.company.press",
    ],
  },
  {
    titleKey: "footer.col.help",
    itemKeys: [
      "footer.help.faq",
      "footer.help.contact",
      "footer.help.tracking",
      "footer.help.whatsapp",
    ],
  },
  {
    titleKey: "footer.col.legal",
    itemKeys: ["footer.legal.terms", "footer.legal.notice", "footer.legal.privacy"],
  },
];

// ── Components ───────────────────────────────────────────

const MOTIF_CLASSES = {
  stripe: "afx-motif-stripe bg-mint-pale",
  diamond: "afx-motif-diamond bg-surface-3",
  world: "afx-world",
  bg: "afx-motif-bg bg-surface-2",
} as const;

function ServiceCard({
  icon: Icon,
  name,
  sub,
  desc,
  motif,
  image,
  moreLabel,
}: {
  icon: typeof Package;
  name: string;
  sub: string;
  desc: string;
  motif: keyof typeof MOTIF_CLASSES;
  image?: string;
  moreLabel: string;
}) {
  return (
    <article className="group rounded-2xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-brand-md">
      <div className={`h-[140px] relative overflow-hidden ${MOTIF_CLASSES[motif]}`}>
        {image ? (
          <>
            <Image
              src={image}
              alt={name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night/55 via-night/20 to-transparent" />
          </>
        ) : (
          <Icon
            className={`absolute right-5 bottom-5 h-12 w-12 drop-shadow-md ${
              motif === "world" ? "text-mint" : "text-mint-3/70"
            }`}
          />
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[22px] font-bold tracking-tight text-ink">
            {name}
          </span>
          <Icon className="h-5 w-5 text-mint-3" />
        </div>
        <span className="block text-[13px] text-ink-3 mt-1">{sub}</span>
        <p className="text-sm text-ink-2 mt-2 leading-relaxed">{desc}</p>
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-night hover:text-mint-3 transition-colors"
        >
          {moreLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function Testimonial({
  initials,
  name,
  role,
  quote,
}: {
  initials: string;
  name: string;
  role: string;
  quote: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-7">
      <div className="font-display text-4xl text-mint-3 leading-none h-4">
        “
      </div>
      <p className="text-base leading-relaxed text-ink-2 mt-3">{quote}</p>
      <div className="flex items-center gap-3 mt-5">
        <div className="w-10 h-10 rounded-full bg-mint-soft text-mint-3 grid place-items-center font-semibold text-sm">
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-ink">{name}</span>
          <span className="text-[13px] text-ink-3">{role}</span>
        </div>
      </div>
    </div>
  );
}
