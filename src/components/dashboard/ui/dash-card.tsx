import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function DashCard({
  className,
  children,
  selected = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { selected?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border bg-[var(--dash-surface)] transition-colors",
        selected
          ? "border-[hsl(var(--dash-accent-border))] shadow-[0_0_0_1px_hsl(var(--dash-accent-border))]"
          : "border-[var(--dash-border)] hover:border-[var(--dash-border-strong)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashCardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="text-[var(--dash-text-muted)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight text-[var(--dash-text)] truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[var(--dash-text-muted)] mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function DashCardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
