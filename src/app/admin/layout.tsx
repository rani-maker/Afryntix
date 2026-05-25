import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
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

const items: DashNavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: <LayoutDashboard />, exact: true, section: "Pilotage" },
  { href: "/admin/statistics", label: "Statistiques", icon: <BarChart3 />, section: "Pilotage" },
  { href: "/admin/analytics", label: "Analytics avancé", icon: <BarChart3 />, section: "Pilotage" },
  { href: "/admin/staff", label: "Équipe (Staff)", icon: <UserCog />, section: "Personnes" },
  { href: "/admin/clients", label: "Clients", icon: <Users />, section: "Personnes" },
  { href: "/admin/partners", label: "Partenaires", icon: <Handshake />, section: "Personnes" },
  { href: "/admin/shipments", label: "Expéditions", icon: <Package />, section: "Opérations" },
  { href: "/admin/reservations", label: "Réservations", icon: <ClipboardList />, section: "Opérations" },
  { href: "/admin/services", label: "Demandes de service", icon: <Briefcase />, section: "Opérations" },
  { href: "/admin/claims", label: "Réclamations", icon: <AlertTriangle />, section: "Opérations" },
  { href: "/admin/schedules", label: "Calendrier d'envois", icon: <CalendarRange />, section: "Opérations" },
  { href: "/admin/payments", label: "Transferts / Factures", icon: <CreditCard />, section: "Finance" },
  { href: "/admin/pricing", label: "Tarification", icon: <Tags />, section: "Finance" },
  { href: "/admin/contract-pricing", label: "Tarifs clients", icon: <Tags />, section: "Finance" },
  { href: "/admin/exchange-rates", label: "Taux de change", icon: <Coins />, section: "Finance" },
  { href: "/admin/storage", label: "Entreposage", icon: <Warehouse />, section: "Finance" },
  { href: "/admin/insurance", label: "Assurance cargo", icon: <Umbrella />, section: "Finance" },
  { href: "/admin/addresses", label: "Adresses entreprise", icon: <Building2 />, section: "Configuration" },
  { href: "/admin/audit", label: "Audit & Notifications", icon: <ShieldCheck />, section: "Configuration" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle="Espace Administrateur" items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title="Administration"
            subtitle="Pilotage global AFRYNTIX"
            status={{ label: "Connecté en direct", tone: "live" }}
            user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
