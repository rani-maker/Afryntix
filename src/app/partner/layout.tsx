import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashSidebar, type DashNavItem } from "@/components/dashboard/dash-sidebar";
import { DashTopbar } from "@/components/dashboard/dash-topbar";
import { DashThemeProvider } from "@/components/dashboard/ui/theme-provider";
import { LayoutDashboard, Package, Coins, UserCircle, Truck, FileText } from "lucide-react";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/staff");
  if (session.user.role === "CLIENT") redirect("/dashboard");
  if (session.user.role !== "PARTNER") redirect("/login");

  // Récupère le type de partenaire pour adapter le menu
  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { type: true, status: true, companyName: true },
  });

  const items: DashNavItem[] = [
    { href: "/partner", label: "Tableau de bord", icon: <LayoutDashboard />, exact: true, section: "Pilotage" },
  ];

  if (partner?.type === "TRANSPORTEUR_RELAIS") {
    items.push({ href: "/partner/deliveries", label: "Livraisons à effectuer", icon: <Truck />, section: "Activité" });
  } else if (partner?.type === "REVENDEUR") {
    items.push(
      { href: "/partner/orders", label: "Mes commandes", icon: <FileText />, section: "Activité" },
      { href: "/partner/shipments", label: "Colis livrés", icon: <Package />, section: "Activité" },
    );
  } else {
    // APPORTEUR, AGENT_CHINE, CONFRERE_FORWARDER
    items.push({ href: "/partner/shipments", label: "Colis apportés", icon: <Package />, section: "Activité" });
  }

  items.push(
    { href: "/partner/commissions", label: "Commissions & versements", icon: <Coins />, section: "Activité" },
    { href: "/partner/profile", label: "Mon profil", icon: <UserCircle />, section: "Compte" },
  );

  return (
    <DashThemeProvider>
      <div className="h-screen flex overflow-hidden">
        <DashSidebar brandSubtitle="Espace Partenaire" items={items} />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--dash-bg)] h-screen overflow-y-auto">
          <DashTopbar
            title="Portail Partenaire"
            subtitle={partner?.companyName ?? "Suivi de votre activité"}
            status={{ label: "Connecté", tone: "live" }}
            user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </DashThemeProvider>
  );
}
