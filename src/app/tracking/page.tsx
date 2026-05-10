"use client";
import Image from "next/image";
import { Ship, Plane, MessageCircle } from "lucide-react";
import { TrackingSearchForm } from "@/components/tracking/tracking-search-form";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";

export default function TrackingHomePage() {
  const { t } = useLang();
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/tracking" />

      <section className="container px-6 md:px-12 py-16">
        <div className="grid lg:grid-cols-[1fr_420px] gap-12 items-start">
          <div className="flex flex-col gap-6">
            <span className="afx-kicker">{t("tracking.kicker")}</span>
            <h1 className="afx-h1">
              {t("tracking.title.where")}<br />
              <span className="italic text-mint-3">{t("tracking.title.parcel")}</span> ?
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed max-w-[520px]">
              {t("tracking.lead")}
            </p>
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-brand-md">
              <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>
                {t("tracking.label")}
              </span>
              <div className="mt-3">
                <TrackingSearchForm />
              </div>
              <p className="text-[12px] text-ink-3 mt-3">
                Format : <span className="font-mono text-ink-2">AFR-A-2026-123456</span> ·{" "}
                <span className="font-mono text-ink-2">AFR-M-2026-...</span>
              </p>
            </div>
          </div>

          <aside className="relative h-[420px] rounded-2xl overflow-hidden p-6 text-white">
            <Image
              src="/images/tracking.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-night/55 via-night/75 to-mint-3/40" />
            <div className="afx-motif-stripe absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
            <div className="relative flex flex-col h-full justify-between">
              <div>
                <span className="afx-kicker" style={{ color: "var(--afx-mint-soft)" }}>
                  2 MODES DE TRANSPORT
                </span>
                <div className="font-display text-2xl font-semibold mt-2">
                  Aérien · Maritime
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  [Plane, "Aérien", "5–7 jours"],
                  [Ship, "Maritime", "30–45 jours"],
                ].map(([Icon, label, eta]) => {
                  const I = Icon as typeof Ship;
                  return (
                    <div key={label as string} className="flex items-center gap-3">
                      <I className="h-5 w-5 text-mint" />
                      <span className="text-sm font-semibold">{label as string}</span>
                      <span className="text-xs text-white/70 ml-auto font-mono">
                        {eta as string}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-white/70">
                <MessageCircle className="h-3.5 w-3.5 text-mint" />
                Notifications WhatsApp à chaque étape
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
