import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function TopbarPill({
  icon,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3.5 py-2 text-sm text-[var(--dash-text)] transition-colors hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-surface-2)]",
        "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-[var(--dash-text-muted)]",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border transition-colors",
        active
          ? "border-[hsl(var(--dash-accent-border))] bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]"
          : "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-surface-2)]",
        "[&>svg]:h-4 [&>svg]:w-4",
        className,
      )}
    >
      {icon}
    </button>
  );
}
