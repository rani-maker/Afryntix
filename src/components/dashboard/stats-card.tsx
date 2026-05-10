import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatsCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "info";
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
  };
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        {icon && (
          <div
            className={cn(
              "h-9 w-9 rounded-lg grid place-items-center [&>svg]:h-4 [&>svg]:w-4",
              toneClasses[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary block"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-xl border bg-card p-5 shadow-sm">{inner}</div>;
}
