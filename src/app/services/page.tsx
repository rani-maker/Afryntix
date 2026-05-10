"use client";
import Image from "next/image";
import {
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wrench,
  Handshake,
  Globe2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { PublicServiceForm } from "./public-service-form";
import { useLang } from "@/components/public/public-language-provider";
import type { TKey } from "@/lib/i18n";

type ServiceCard = {
  type: string;
  icon: typeof ShieldCheck;
  titleKey: TKey;
  descKey: TKey;
  motif: "stripe" | "diamond" | "world" | "bg";
  image?: string;
};

const SERVICES: ReadonlyArray<ServiceCard> = [
  {
    type: "QUALITY_CONTROL",
    icon: ShieldCheck,
    titleKey: "psvc.qc.title",
    descKey: "psvc.qc.desc",
    motif: "stripe",
    image: "/images/controle-qualite.jpg",
  },
  {
    type: "PURCHASING",
    icon: ShoppingCart,
    titleKey: "psvc.purchasing.title",
    descKey: "psvc.purchasing.desc",
    motif: "diamond",
    image: "/images/sourcing.webp",
  },
  {
    type: "VEHICLE_SALE",
    icon: Truck,
    titleKey: "psvc.vehicle.title",
    descKey: "psvc.vehicle.desc",
    motif: "world",
    image: "/images/vehicule.jpg",
  },
  {
    type: "BTP_SALE",
    icon: Wrench,
    titleKey: "psvc.btp.title",
    descKey: "psvc.btp.desc",
    motif: "stripe",
    image: "/images/btp.jpg",
  },
  {
    type: "TRADING",
    icon: Globe2,
    titleKey: "psvc.trading.title",
    descKey: "psvc.trading.desc",
    motif: "diamond",
    image: "/images/payez-fournisseur.jpg",
  },
  {
    type: "INTRODUCTION",
    icon: Handshake,
    titleKey: "psvc.intro.title",
    descKey: "psvc.intro.desc",
    motif: "bg",
    image: "/images/mise-en-relation.jpg",
  },
];

const MOTIF_CLASSES = {
  stripe: "afx-motif-stripe bg-mint-pale",
  diamond: "afx-motif-diamond bg-surface-3",
  world: "afx-world",
  bg: "afx-motif-bg bg-surface-2",
} as const;

export default function PublicServicesPage() {
  const { t } = useLang();
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/services" />

      {/* Hero */}
      <section className="relative overflow-hidden isolate">
        {/* Background banner image */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <Image
            src="/images/service-banner.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80" />
        </div>
        <div className="container px-6 md:px-12 pt-16 pb-10 relative">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div className="flex flex-col gap-4 max-w-3xl">
            <span className="afx-kicker">{t("services.kicker")}</span>
            <h1 className="afx-h1">
              {t("services.title.handle")} <span className="italic text-mint-3">{t("services.title.all")}</span><br />
              {t("services.title.relation")}
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed">
              {t("services.lead")}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-mint text-ink hover:bg-mint-2 h-12 px-6 text-[15px] font-semibold"
          >
            <a href="#demande">
              {t("services.cta")} <ArrowRight className="h-4 w-4 ml-1" />
            </a>
          </Button>
        </div>
        </div>
      </section>

      <div className="afx-motif-stripe h-2" />

      {/* Services grid */}
      <section className="container px-6 md:px-12 py-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            const title = t(s.titleKey);
            return (
              <article
                key={s.type}
                className="group rounded-2xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-brand-md"
              >
                <div className={`h-[140px] relative overflow-hidden ${MOTIF_CLASSES[s.motif]}`}>
                  {s.image ? (
                    <>
                      <Image
                        src={s.image}
                        alt={title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-night/55 via-night/20 to-transparent" />
                    </>
                  ) : (
                    <Icon
                      className={`absolute right-5 bottom-5 h-12 w-12 drop-shadow-md ${
                        s.motif === "world" ? "text-mint" : "text-mint-3/70"
                      }`}
                    />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[20px] font-bold tracking-tight text-ink">
                      {title}
                    </span>
                    <Icon className="h-5 w-5 text-mint-3 shrink-0" />
                  </div>
                  <p className="text-sm text-ink-2 mt-2 leading-relaxed">
                    {t(s.descKey)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Demande de service */}
      <section
        id="demande"
        className="afx-surface-night px-6 md:px-12 py-16"
      >
        <div className="container max-w-3xl">
          <div className="flex flex-col gap-3 mb-8">
            <span className="afx-kicker" style={{ color: "var(--afx-mint-soft)" }}>
              {t("services.form.kicker")}
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white tracking-tight">
              {t("services.form.title")}
            </h2>
            <p className="text-white/70 max-w-xl">
              {t("services.form.lead")}
            </p>
          </div>
          <div className="rounded-2xl bg-surface text-ink p-6 md:p-8">
            <PublicServiceForm />
          </div>
        </div>
      </section>
    </main>
  );
}
