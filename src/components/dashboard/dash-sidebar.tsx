"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { PanelLeft, PanelLeftClose, X } from "lucide-react";
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

function groupItems(items: DashNavItem[]) {
  const grouped: { section?: string; items: DashNavItem[] }[] = [];
  for (const item of items) {
    const last = grouped[grouped.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      grouped.push({ section: item.section, items: [item] });
    }
  }
  return grouped;
}

function SidebarNav({
  items,
  collapsed,
  brandSubtitle,
  showCollapseBtn,
  onToggleCollapse,
  onClose,
}: {
  items: DashNavItem[];
  collapsed: boolean;
  brandSubtitle: string;
  showCollapseBtn?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { theme } = useDashTheme();
  const grouped = groupItems(items);

  return (
    <>
      <div
        className={cn(
          "h-16 flex items-center shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="AFRYNTIX - accueil">
            <Logo variant="sm" tone={theme === "light" ? "light" : "dark"} className="h-8 w-auto" />
            <div className="text-[10px] text-[var(--dash-text-dim)] leading-none mt-1">
              {brandSubtitle}
            </div>
          </Link>
        )}
        {showCollapseBtn && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
            aria-expanded={!collapsed}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] transition-colors"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
        {grouped.map((group, gi) => (
          <div key={gi}>
            {group.section && !collapsed && <SectionLabel>{group.section}</SectionLabel>}
            {(!group.section && gi === 0) || collapsed ? <div className="h-2" /> : null}
            <div className="space-y-0.5">
              {group.items.map((it) => {
                const active = it.exact
                  ? pathname === it.href
                  : pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={collapsed ? it.label : undefined}
                    aria-label={collapsed ? it.label : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
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
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

export function DashSidebar({
  brandSubtitle,
  items,
}: {
  brandSubtitle: string;
  items: DashNavItem[];
}) {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useDashTheme();
  const pathname = usePathname();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-[var(--dash-border)] bg-[var(--dash-bg)] transition-[width] duration-200 ease-out",
          sidebarCollapsed ? "md:w-16" : "md:w-64",
        )}
      >
        <SidebarNav
          items={items}
          collapsed={sidebarCollapsed}
          brandSubtitle={brandSubtitle}
          showCollapseBtn
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-72 h-full border-r border-[var(--dash-border)] bg-[var(--dash-bg)] shadow-2xl shadow-black/50">
            <SidebarNav
              items={items}
              collapsed={false}
              brandSubtitle={brandSubtitle}
              onClose={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
