"use client";

import { Languages, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/public/public-language-provider";
import { LANG_LABELS, LANG_ORDER, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FULL_LABEL: Record<Lang, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  zh: "中文",
};

export function DashLangSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("dash.lang.label")}
        className="inline-flex items-center gap-1.5 h-9 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 text-xs font-semibold text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] transition-colors"
      >
        <Languages className="h-4 w-4" />
        <span className="font-mono">{LANG_LABELS[lang]}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-2xl shadow-black/40 overflow-hidden z-50">
          {LANG_ORDER.map((l) => {
            const active = l === lang;
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]"
                    : "text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] w-6 text-left">
                    {LANG_LABELS[l]}
                  </span>
                  <span>{FULL_LABEL[l]}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
