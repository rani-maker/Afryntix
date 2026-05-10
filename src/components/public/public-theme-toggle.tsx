"use client";

import { Moon, Sun } from "lucide-react";
import { usePublicTheme } from "./public-theme-provider";
import { cn } from "@/lib/utils";

export function PublicThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = usePublicTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card p-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Mode clair"
        onClick={() => setTheme("light")}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full transition-colors",
          theme === "light"
            ? "bg-amber-100 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Mode sombre"
        onClick={() => setTheme("dark")}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full transition-colors",
          theme === "dark"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
