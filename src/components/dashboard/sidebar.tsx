"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  section?: string;
};

export function Sidebar({
  brandSubtitle,
  items,
}: {
  brandSubtitle: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r bg-white">
      <div className="h-16 px-5 flex items-center border-b">
        <Link href="/" className="flex items-center gap-3" aria-label="AFRYNTIX - accueil">
          <Logo variant="sm" className="h-9 w-auto" />
          <div className="text-[10px] text-muted-foreground leading-none">
            {brandSubtitle}
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {items.map((it) => {
          const active = it.exact
            ? pathname === it.href
            : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="[&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
