"use client";

import {
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  CalendarRange,
  Tags,
  Coins,
  CreditCard,
  Building2,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  Briefcase,
  Warehouse,
  AlertTriangle,
  Umbrella,
  Handshake,
} from "lucide-react";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import { useLang } from "@/components/public/public-language-provider";

export function AdminDashShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const SEC = {
    pilotage: t("dash.section.pilotage"),
    persons: t("dash.section.persons"),
    operations: t("dash.section.operations"),
    finance: t("dash.section.finance"),
    config: t("dash.section.config"),
  };

  const items: DashNavItem[] = [
    { href: "/admin", label: t("admin.nav.overview"), icon: <LayoutDashboard />, exact: true, section: SEC.pilotage },
    { href: "/admin/statistics", label: t("admin.nav.statistics"), icon: <BarChart3 />, section: SEC.pilotage },
    { href: "/admin/analytics", label: t("admin.nav.analytics"), icon: <BarChart3 />, section: SEC.pilotage },
    { href: "/admin/staff", label: t("admin.nav.staff"), icon: <UserCog />, section: SEC.persons },
    { href: "/admin/clients", label: t("admin.nav.clients"), icon: <Users />, section: SEC.persons },
    { href: "/admin/partners", label: t("admin.nav.partners"), icon: <Handshake />, section: SEC.persons },
    { href: "/admin/shipments", label: t("admin.nav.shipments"), icon: <Package />, section: SEC.operations },
    { href: "/admin/reservations", label: t("admin.nav.reservations"), icon: <ClipboardList />, section: SEC.operations },
    { href: "/admin/services", label: t("admin.nav.services"), icon: <Briefcase />, section: SEC.operations },
    { href: "/admin/claims", label: t("admin.nav.claims"), icon: <AlertTriangle />, section: SEC.operations },
    { href: "/admin/schedules", label: t("admin.nav.schedules"), icon: <CalendarRange />, section: SEC.operations },
    { href: "/admin/payments", label: t("admin.nav.payments"), icon: <CreditCard />, section: SEC.finance },
    { href: "/admin/pricing", label: t("admin.nav.pricing"), icon: <Tags />, section: SEC.finance },
    { href: "/admin/contract-pricing", label: t("admin.nav.contract_pricing"), icon: <Tags />, section: SEC.finance },
    { href: "/admin/exchange-rates", label: t("admin.nav.exchange_rates"), icon: <Coins />, section: SEC.finance },
    { href: "/admin/storage", label: t("admin.nav.storage"), icon: <Warehouse />, section: SEC.finance },
    { href: "/admin/insurance", label: t("admin.nav.insurance"), icon: <Umbrella />, section: SEC.finance },
    { href: "/admin/addresses", label: t("admin.nav.addresses"), icon: <Building2 />, section: SEC.config },
    { href: "/admin/audit", label: t("admin.nav.audit"), icon: <ShieldCheck />, section: SEC.config },
  ];

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle={t("admin.brand.subtitle")} items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title={t("admin.topbar.title")}
            subtitle={t("admin.topbar.subtitle")}
            status={{ label: t("dash.topbar.live"), tone: "live" }}
            user={user}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
