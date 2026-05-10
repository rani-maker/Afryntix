import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "info"
  | "danger";

const TONE_STYLES: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  neutral: {
    bg: "bg-white/[0.04]",
    text: "text-[var(--dash-text-muted)]",
    dot: "bg-[var(--dash-text-muted)]",
  },
  accent: {
    bg: "bg-[hsl(var(--dash-accent-soft))]",
    text: "text-[hsl(var(--dash-accent))]",
    dot: "bg-[hsl(var(--dash-accent))]",
  },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  danger: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
  },
};

export function StatusPill({
  tone = "neutral",
  pulse = false,
  icon,
  children,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        t.bg,
        t.text,
        className,
      )}
    >
      {icon ? (
        <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      ) : (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", t.dot, pulse && "dash-pulse-dot")}
        />
      )}
      {children}
    </span>
  );
}
