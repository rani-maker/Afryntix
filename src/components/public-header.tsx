"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { PublicThemeToggle } from "@/components/public/public-theme-toggle";
import { PublicLanguageToggle } from "@/components/public/public-language-toggle";
import { useLang } from "@/components/public/public-language-provider";
import type { TKey } from "@/lib/i18n";

function dashboardHref(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "STAFF") return "/staff";
  return "/dashboard";
}

const NAV_LINKS: Array<{ href: string; key: TKey }> = [
  { href: "/", key: "nav.home" },
  { href: "/services", key: "nav.services" },
  { href: "/tracking", key: "nav.tracking" },
  { href: "/addresses", key: "nav.addresses" },
  { href: "/withdraw", key: "nav.withdraw" },
];

export function PublicHeader({ active }: { active?: string }) {
  const { t } = useLang();
  const { data: session, status } = useSession();
  const isAuth = status === "authenticated" && !!session?.user;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const dashHref = dashboardHref(role);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-6 px-6 md:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="AFRYNTIX">
          <Logo variant="sm" tone="auto" priority className="h-9 w-auto" />
          <div className="hidden sm:block">
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-mint-3 leading-none">
              {t("header.subtitle")}
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors hover:text-ink ${
                active === l.href
                  ? "text-ink font-bold"
                  : "text-ink-3 font-medium"
              }`}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <PublicThemeToggle />
          <PublicLanguageToggle />
          {isAuth ? (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
                <Link href={dashHref}>Tableau de bord</Link>
              </Button>
              <Button
                size="sm"
                className="rounded-full bg-night text-white hover:bg-night-2"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-full bg-night text-white hover:bg-night-2"
              >
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </>
          )}
        </div>

        <nav className="md:hidden flex items-center gap-3 text-sm">
          <PublicThemeToggle />
          <PublicLanguageToggle />
          <Link href="/tracking" className="text-ink-3 hover:text-ink">{t("nav.tracking")}</Link>
          {isAuth ? (
            <Link href={dashHref} className="text-ink-3 hover:text-ink">Dashboard</Link>
          ) : (
            <Link href="/login" className="text-ink-3 hover:text-ink">{t("nav.login")}</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
