"use client";

import { Languages } from "lucide-react";
import { useLang } from "./public-language-provider";
import { LANG_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PublicLanguageToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLang();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Changer de langue"
      className={cn(
        "inline-flex items-center gap-1.5 h-8 rounded-full border border-border bg-card px-3 text-xs font-semibold text-ink-3 transition-colors hover:text-ink hover:border-line-2",
        className,
      )}
    >
      <Languages className="h-3.5 w-3.5" />
      <span className="font-mono">{LANG_LABELS[lang]}</span>
    </button>
  );
}
