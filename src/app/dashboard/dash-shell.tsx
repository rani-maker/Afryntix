"use client";

import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CalendarDays,
  Briefcase,
  Building2,
  User,
} from "lucide-react";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import { useLang } from "@/components/public/public-language-provider";

export function ClientDashShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const sectionMain = t("dash.section.main");
  const sectionServices = t("dash.section.services");
  const sectionAccount = t("dash.section.account");

  const items: DashNavItem[] = [
    {
      href: "/dashboard",
      label: t("dash.nav.dashboard"),
      icon: <LayoutDashboard />,
      exact: true,
      section: sectionMain,
    },
    {
      href: "/dashboard/shipments",
      label: t("dash.nav.shipments"),
      icon: <Package />,
      section: sectionMain,
    },
    {
      href: "/dashboard/reservations",
      label: t("dash.nav.reservations"),
      icon: <ClipboardList />,
      section: sectionMain,
    },
    {
      href: "/dashboard/schedules",
      label: t("dash.nav.schedules"),
      icon: <CalendarDays />,
      section: sectionMain,
    },
    {
      href: "/dashboard/services",
      label: t("dash.nav.services"),
      icon: <Briefcase />,
      section: sectionServices,
    },
    {
      href: "/dashboard/addresses",
      label: t("dash.nav.addresses"),
      icon: <Building2 />,
      section: sectionServices,
    },
    {
      href: "/dashboard/profile",
      label: t("dash.nav.profile"),
      icon: <User />,
      section: sectionAccount,
    },
  ];

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle={t("dash.brand.subtitle")} items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title={t("dash.topbar.title")}
            subtitle={t("dash.topbar.subtitle")}
            status={{ label: t("dash.topbar.live"), tone: "live" }}
            user={user}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
