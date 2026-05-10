"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { SectionLabel } from "./ui/section-label";
import { Logo } from "@/components/brand/logo";
import { useDashTheme } from "./ui/theme-provider";

export type DashNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  section?: string;
};

export function DashSidebar({
  brandSubtitle,
  items,
}: {
  brandSubtitle: string;
  items: DashNavItem[];
}) {
  const pathname = usePathname();
  const { theme, sidebarCollapsed, toggleSidebar } = useDashTheme();

  const grouped: { section?: string; items: DashNavItem[] }[] = [];
  for (const item of items) {
    const last = grouped[grouped.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      grouped.push({ section: item.section, items: [item] });
    }
  }

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-[var(--dash-border)] bg-[var(--dash-bg)] transition-[width] duration-200 ease-out",
        sidebarCollapsed ? "md:w-16" : "md:w-64",
      )}
    >
      <div
        className={cn(
          "h-16 flex items-center",
          sidebarCollapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!sidebarCollapsed && (
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="AFRYNTIX - accueil">
            <Logo variant="sm" tone={theme === "light" ? "light" : "dark"} className="h-8 w-auto" />
            <div className="text-[10px] text-[var(--dash-text-dim)] leading-none mt-1">
              {brandSubtitle}
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Déplier la sidebar" : "Replier la sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] transition-colors"
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-4", sidebarCollapsed ? "px-2" : "px-3")}>
        {grouped.map((group, gi) => (
          <div key={gi}>
            {group.section && !sidebarCollapsed && <SectionLabel>{group.section}</SectionLabel>}
            {(!group.section && gi === 0) || sidebarCollapsed ? <div className="h-2" /> : null}
            <div className="space-y-0.5">
              {group.items.map((it) => {
                const active = it.exact
                  ? pathname === it.href
                  : pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={sidebarCollapsed ? it.label : undefined}
                    aria-label={sidebarCollapsed ? it.label : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-[13px] font-medium transition-colors",
                      sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                      active
                        ? "bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]"
                        : "text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)]",
                    )}
                  >
                    <span
                      className={cn(
                        "[&>svg]:h-4 [&>svg]:w-4",
                        active ? "text-[hsl(var(--dash-accent))]" : "",
                      )}
                    >
                      {it.icon}
                    </span>
                    {!sidebarCollapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
