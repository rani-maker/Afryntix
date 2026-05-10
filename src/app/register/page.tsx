"use client";
import Link from "next/link";
import Image from "next/image";
import { RegisterForm } from "@/components/auth/register-form";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { useLang } from "@/components/public/public-language-provider";

export default function RegisterPage() {
  const { t } = useLang();
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/register" />
      <div className="grid lg:grid-cols-2">
        {/* Left — editorial branding */}
        <aside className="hidden lg:flex relative overflow-hidden text-white min-h-[calc(100vh-4rem)]">
          <Image
            src="/images/login.jpg"
            alt=""
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-night/90 via-night/75 to-mint-3/55" />
          <div className="afx-motif-diamond absolute inset-0 opacity-10" />
          <div className="relative flex flex-col justify-between p-12 w-full">
            <Link href="/" aria-label="AFRYNTIX - accueil">
              <Logo variant="md" tone="dark" priority className="h-12 w-auto" />
            </Link>
            <div className="flex flex-col gap-5">
              <span className="font-cn text-xl text-white/90">{t("auth.register.greeting_cn")}</span>
              <h2 className="font-display text-5xl xl:text-6xl font-semibold leading-[1] tracking-tight text-white">
                {t("auth.register.welcome")}
              </h2>
              <p className="text-[17px] leading-relaxed text-white/85 max-w-md">
                {t("auth.register.lead")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-white/60">
                © {new Date().getFullYear()} AFRYNTIX
              </span>
              <span className="text-[13px] text-white/70">
                {t("auth.register.modes")}
              </span>
            </div>
          </div>
        </aside>

        {/* Right — form */}
        <div className="relative flex items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-md flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="afx-kicker">{t("auth.register.kicker")}</span>
              <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                {t("auth.register.title")}
              </h1>
            </div>
            <p className="text-sm text-ink-2">
              {t("auth.register.have_account")}{" "}
              <Link
                href="/login"
                className="text-mint-3 font-semibold underline underline-offset-4 hover:text-mint-2"
              >
                {t("auth.register.signin")}
              </Link>
            </p>
            <RegisterForm />
          </div>
        </div>
      </div>
    </main>
  );
}
