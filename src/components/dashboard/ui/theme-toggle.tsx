"use client";

import { Moon, Sun } from "lucide-react";
import { useDashTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useDashTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] p-1">
      <button
        type="button"
        aria-label="Mode sombre"
        onClick={() => setTheme("dark")}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full transition-colors",
          theme === "dark"
            ? "bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]"
            : "text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]",
        )}
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Mode clair"
        onClick={() => setTheme("light")}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full transition-colors",
          theme === "light"
            ? "bg-amber-400/20 text-amber-300"
            : "text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]",
        )}
      >
        <Sun className="h-4 w-4" />
      </button>
    </div>
  );
}
