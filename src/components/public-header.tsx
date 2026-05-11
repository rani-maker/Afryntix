"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { serverSignOut } from "@/server/actions/auth";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4 px-6 md:px-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="AFRYNTIX"
            onClick={() => setOpen(false)}>
            <Logo variant="sm" tone="auto" priority className="h-9 w-auto" />
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-mint-3 leading-none">
                {t("header.subtitle")}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className={`transition-colors hover:text-ink ${
                  active === l.href ? "text-ink font-bold" : "text-ink-3 font-medium"
                }`}>
                {t(l.key)}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <PublicThemeToggle />
            <PublicLanguageToggle />
            {isAuth ? (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
                  <Link href={dashHref}>Tableau de bord</Link>
                </Button>
                <Button size="sm" className="rounded-full bg-night text-white hover:bg-night-2"
                  onClick={() => serverSignOut()}>
                  Déconnexion
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
                  <Link href="/login">{t("nav.login")}</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full bg-night text-white hover:bg-night-2">
                  <Link href="/register">{t("nav.register")}</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile right: toggles + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <PublicThemeToggle />
            <PublicLanguageToggle />
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              className="w-9 h-9 rounded-lg border border-line bg-surface-2 flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
            >
              {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-16 z-30 bg-surface/95 backdrop-blur-md border-t border-line overflow-y-auto">
          <nav className="container px-6 py-6 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center h-12 px-3 rounded-xl text-[15px] font-medium transition-colors ${
                  active === l.href
                    ? "bg-mint-soft text-mint-3 font-semibold"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}>
                {t(l.key)}
              </Link>
            ))}

            <div className="my-3 border-t border-line" />

            {isAuth ? (
              <>
                <Link href={dashHref} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors">
                  <LayoutDashboard className="h-4 w-4 text-mint-3 shrink-0" />
                  Tableau de bord
                </Link>
                <button onClick={() => { setOpen(false); serverSignOut(); }}
                  className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors w-full text-left">
                  <LogOut className="h-4 w-4 text-ink-3 shrink-0" />
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Button asChild variant="outline" className="rounded-full border-line-2 h-11">
                  <Link href="/login" onClick={() => setOpen(false)}>{t("nav.login")}</Link>
                </Button>
                <Button asChild className="rounded-full bg-night text-white hover:bg-night-2 h-11">
                  <Link href="/register" onClick={() => setOpen(false)}>{t("nav.register")}</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
