"use client";

import { Calendar, ChevronDown, LogOut, Menu, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { serverSignOut } from "@/server/actions/auth";
import { TopbarPill } from "./ui/topbar-pill";
import { ThemeToggle } from "./ui/theme-toggle";
import { DashLangSwitcher } from "./ui/lang-switcher";
import { NotificationsBell } from "./notifications-bell";
import { useDashTheme } from "./ui/theme-provider";
import { useLang } from "@/components/public/public-language-provider";
import type { Lang } from "@/lib/i18n";

function formatDate(d: Date, lang: Lang) {
  const locale =
    lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : lang === "en" ? "en-US" : "fr-FR";
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function DashTopbar({
  title,
  subtitle,
  user,
  status,
}: {
  title: string;
  subtitle?: string;
  user: { name: string; email: string; role: string };
  status?: { label: string; tone?: "live" | "neutral" };
}) {
  const { lang, t } = useLang();
  const [today, setToday] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { setMobileNavOpen } = useDashTheme();

  useEffect(() => {
    setToday(formatDate(new Date(), lang));
  }, [lang]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const initials = useMemo(
    () =>
      (user.name || user.email || "?")
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [user.name, user.email],
  );

  const userFallback = t("dash.user.fallback");

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[var(--dash-border)] bg-[var(--dash-bg)]/75 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--dash-bg)]/65 px-4 md:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label={t("dash.menu.open")}
          className="md:hidden grid h-8 w-8 place-items-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] transition-colors shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-tight text-[var(--dash-text)] tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--dash-text-muted)] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {status && (
          <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text)]">
            <Radio
              className={`h-3.5 w-3.5 ${
                status.tone === "live"
                  ? "text-[hsl(var(--dash-accent))] dash-pulse-dot"
                  : "text-[var(--dash-text-muted)]"
              }`}
            />
            {status.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {today && (
          <TopbarPill icon={<Calendar />} className="hidden sm:inline-flex">
            {today}
          </TopbarPill>
        )}

        <div className="hidden sm:block">
          <DashLangSwitcher />
        </div>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        <NotificationsBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] py-1.5 pl-1.5 pr-3 hover:border-[var(--dash-border-strong)] transition-colors"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))] text-xs font-semibold">
              {initials || "?"}
            </span>
            <div className="text-left hidden sm:block">
              <div className="text-[13px] font-medium leading-none text-[var(--dash-text)]">
                {user.name || userFallback}
              </div>
              <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5 leading-none truncate max-w-[180px]">
                {user.email}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-[var(--dash-text-muted)]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-2xl shadow-black/40 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[var(--dash-border)]">
                <div className="text-[13px] font-medium text-[var(--dash-text)]">
                  {user.name || userFallback}
                </div>
                <div className="text-[11px] text-[var(--dash-text-muted)] truncate">
                  {user.email}
                </div>
                <div className="mt-2 inline-flex items-center rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--dash-accent))]">
                  {user.role}
                </div>
              </div>
              <button
                type="button"
                onClick={() => serverSignOut()}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] transition-colors"
              >
                <LogOut className="h-4 w-4" /> {t("dash.signout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
