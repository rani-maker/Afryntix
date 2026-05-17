"use client";
import Image from "next/image";
import { use } from "react";
import { Banknote, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";
import type { TKey } from "@/lib/i18n";
import { lookupWithdrawalAction } from "./actions";

export default function WithdrawHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = useLang();
  const { error } = use(searchParams);

  const errorKey: TKey | null =
    error === "empty"
      ? "withdraw.error.empty"
      : error === "notfound"
        ? "withdraw.error.notfound"
        : error === "ratelimit"
          ? "withdraw.error.ratelimit"
          : error
            ? "withdraw.error.generic"
            : null;

  const features: Array<{
    icon: typeof Wallet;
    labelKey: TKey;
    subKey: TKey;
  }> = [
    { icon: Wallet, labelKey: "withdraw.aside.f1.label", subKey: "withdraw.aside.f1.sub" },
    { icon: ShieldCheck, labelKey: "withdraw.aside.f2.label", subKey: "withdraw.aside.f2.sub" },
    { icon: Banknote, labelKey: "withdraw.aside.f3.label", subKey: "withdraw.aside.f3.sub" },
  ];

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/withdraw" />

      <section className="container px-6 md:px-12 py-16">
        <div className="grid lg:grid-cols-[1fr_420px] gap-12 items-start">
          <div className="flex flex-col gap-6">
            <span className="afx-kicker">{t("withdraw.kicker")}</span>
            <h1 className="afx-h1">
              {t("withdraw.title.recover")}<br />
              <span className="italic text-mint-3">{t("withdraw.title.transfer")}</span>.
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed max-w-[520px]">
              {t("withdraw.lead")}
            </p>

            <div className="rounded-2xl border border-line bg-surface p-5 shadow-brand-md">
              <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>
                {t("withdraw.code.label")}
              </span>
              {errorKey && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t(errorKey)}
                </div>
              )}
              <form action={lookupWithdrawalAction} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code">{t("withdraw.code.input_label")}</Label>
                  <Input
                    id="code"
                    name="code"
                    required
                    placeholder={t("withdraw.code.placeholder")}
                    className="font-mono uppercase tracking-wider"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full bg-mint text-ink hover:bg-mint-2 h-12 text-[15px] font-semibold"
                >
                  {t("withdraw.code.verify")}
                </Button>
              </form>
              <p className="text-[12px] text-ink-3 mt-3">{t("withdraw.code.help")}</p>
            </div>
          </div>

          <aside className="relative h-[420px] rounded-2xl overflow-hidden p-6 text-white">
            <Image
              src="/images/retrait.avif"
              alt=""
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-night/55 via-night/80 to-mint-3/40" />
            <div className="afx-motif-diamond absolute inset-0 opacity-15" />
            <div className="afx-motif-stripe absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
            <div className="relative flex flex-col h-full justify-between">
              <div>
                <span className="afx-kicker" style={{ color: "var(--afx-mint-soft)" }}>
                  {t("withdraw.aside.kicker")}
                </span>
                <div className="font-display text-2xl font-semibold mt-2">
                  {t("withdraw.aside.title")}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.labelKey} className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-mint mt-0.5 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{t(f.labelKey)}</span>
                        <span className="text-xs text-white/70">{t(f.subKey)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-white/70">
                <MessageCircle className="h-3.5 w-3.5 text-mint" />
                {t("withdraw.aside.whatsapp")}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
