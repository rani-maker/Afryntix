import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CreditCard,
  Users,
  Briefcase,
  CalendarRange,
  Ship,
} from "lucide-react";

const items: DashNavItem[] = [
  { href: "/staff", label: "Vue d'ensemble", icon: <LayoutDashboard />, exact: true, section: "Pilotage" },
  { href: "/staff/shipments", label: "Expéditions (colis)", icon: <Package />, section: "Opérations" },
  { href: "/staff/envois", label: "Envois (voyages)", icon: <Ship />, section: "Opérations" },
  { href: "/staff/reservations", label: "Réservations", icon: <ClipboardList />, section: "Opérations" },
  { href: "/staff/services", label: "Demandes de service", icon: <Briefcase />, section: "Opérations" },
  { href: "/staff/schedules", label: "Calendrier", icon: <CalendarRange />, section: "Opérations" },
  { href: "/staff/payments", label: "Transferts / Factures", icon: <CreditCard />, section: "Finance" },
  { href: "/staff/clients", label: "Clients", icon: <Users />, section: "Personnes" },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STAFF" && session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle="Espace Staff" items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title="Espace Staff"
            subtitle="Opérations du jour"
            status={{ label: "Connecté en direct", tone: "live" }}
            user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
