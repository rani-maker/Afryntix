"use client";

import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CreditCard,
  Users,
  Briefcase,
  CalendarRange,
  Ship,
  Tag,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import { useLang } from "@/components/public/public-language-provider";

export function StaffDashShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const SEC = {
    pilotage: t("dash.section.pilotage"),
    operations: t("dash.section.operations"),
    finance: t("dash.section.finance"),
    persons: t("dash.section.persons"),
  };

  const items: DashNavItem[] = [
    { href: "/staff", label: t("staff.nav.overview"), icon: <LayoutDashboard />, exact: true, section: SEC.pilotage },
    { href: "/staff/shipments", label: t("staff.nav.shipments"), icon: <Package />, section: SEC.operations },
    { href: "/staff/shipping-marks", label: t("staff.nav.shipping_marks"), icon: <Tag />, section: SEC.operations },
    { href: "/staff/envois", label: t("staff.nav.envois"), icon: <Ship />, section: SEC.operations },
    { href: "/staff/reservations", label: t("staff.nav.reservations"), icon: <ClipboardList />, section: SEC.operations },
    { href: "/staff/services", label: t("staff.nav.services"), icon: <Briefcase />, section: SEC.operations },
    { href: "/staff/claims", label: t("staff.nav.claims"), icon: <AlertTriangle />, section: SEC.operations },
    { href: "/staff/warehouse", label: t("staff.nav.warehouse"), icon: <Smartphone />, section: SEC.operations },
    { href: "/staff/schedules", label: t("staff.nav.schedules"), icon: <CalendarRange />, section: SEC.operations },
    { href: "/staff/payments", label: t("staff.nav.payments"), icon: <CreditCard />, section: SEC.finance },
    { href: "/staff/clients", label: t("staff.nav.clients"), icon: <Users />, section: SEC.persons },
  ];

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle={t("staff.brand.subtitle")} items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title={t("staff.topbar.title")}
            subtitle={t("staff.topbar.subtitle")}
            status={{ label: t("dash.topbar.live"), tone: "live" }}
            user={user}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
