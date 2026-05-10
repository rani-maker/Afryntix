import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "./status-pill";

const TONE: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: "bg-white/[0.04]", fg: "text-[var(--dash-text-muted)]" },
  accent: {
    bg: "bg-[hsl(var(--dash-accent-soft))]",
    fg: "text-[hsl(var(--dash-accent))]",
  },
  success: { bg: "bg-emerald-500/10", fg: "text-emerald-400" },
  warning: { bg: "bg-amber-500/10", fg: "text-amber-400" },
  info: { bg: "bg-blue-500/10", fg: "text-blue-400" },
  danger: { bg: "bg-red-500/10", fg: "text-red-400" },
};

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "accent",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: StatusTone;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 transition-colors hover:border-[var(--dash-border-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] text-[var(--dash-text-muted)] font-medium">
          {label}
        </div>
        {icon && (
          <div
            className={cn(
              "h-9 w-9 rounded-xl grid place-items-center [&>svg]:h-4 [&>svg]:w-4",
              t.bg,
              t.fg,
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--dash-text)] tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--dash-text-dim)]">{hint}</div>
      )}
    </div>
  );
}
