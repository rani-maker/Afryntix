"use client";

import {
  LayoutDashboard,
  Package,
  Coins,
  UserCircle,
  Truck,
  FileText,
  Warehouse,
  ShoppingBag,
} from "lucide-react";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import { useLang } from "@/components/public/public-language-provider";

export type PartnerType =
  | "TRANSPORTEUR_RELAIS"
  | "REVENDEUR"
  | "AGENT_CHINE"
  | "CONFRERE_FORWARDER"
  | "APPORTEUR"
  | null;

export function PartnerDashShell({
  user,
  partnerType,
  companyName,
  children,
}: {
  user: { name: string; email: string; role: string };
  partnerType: PartnerType;
  companyName?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const sectionPilotage = t("dash.section.pilotage");
  const sectionActivity = t("dash.section.activity");
  const sectionAccount = t("dash.section.account");

  const items: DashNavItem[] = [
    {
      href: "/partner",
      label: t("partner.nav.dashboard"),
      icon: <LayoutDashboard />,
      exact: true,
      section: sectionPilotage,
    },
  ];

  if (partnerType === "TRANSPORTEUR_RELAIS") {
    items.push({
      href: "/partner/deliveries",
      label: t("partner.nav.deliveries"),
      icon: <Truck />,
      section: sectionActivity,
    });
  } else if (partnerType === "REVENDEUR") {
    items.push(
      {
        href: "/partner/orders",
        label: t("partner.nav.orders"),
        icon: <FileText />,
        section: sectionActivity,
      },
      {
        href: "/partner/shipments",
        label: t("partner.nav.shipments_delivered"),
        icon: <Package />,
        section: sectionActivity,
      },
    );
  } else if (partnerType === "AGENT_CHINE") {
    items.push(
      {
        href: "/partner/warehouse",
        label: t("partner.nav.warehouse"),
        icon: <Warehouse />,
        section: sectionActivity,
      },
      {
        href: "/partner/shipments",
        label: t("partner.nav.shipments_processed"),
        icon: <Package />,
        section: sectionActivity,
      },
    );
  } else if (partnerType === "CONFRERE_FORWARDER") {
    items.push(
      {
        href: "/partner/wholesale",
        label: t("partner.nav.wholesale"),
        icon: <ShoppingBag />,
        section: sectionActivity,
      },
      {
        href: "/partner/wholesale/new",
        label: t("partner.nav.wholesale_new"),
        icon: <Package />,
        section: sectionActivity,
      },
    );
  } else {
    // APPORTEUR (default)
    items.push({
      href: "/partner/shipments",
      label: t("partner.nav.shipments_brought"),
      icon: <Package />,
      section: sectionActivity,
    });
  }

  items.push(
    {
      href: "/partner/commissions",
      label: t("partner.nav.commissions"),
      icon: <Coins />,
      section: sectionActivity,
    },
    {
      href: "/partner/profile",
      label: t("partner.nav.profile"),
      icon: <UserCircle />,
      section: sectionAccount,
    },
  );

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle={t("partner.brand.subtitle")} items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title={t("partner.topbar.title")}
            subtitle={companyName ?? t("partner.topbar.subtitle_default")}
            status={{ label: t("dash.topbar.live"), tone: "live" }}
            user={user}
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
