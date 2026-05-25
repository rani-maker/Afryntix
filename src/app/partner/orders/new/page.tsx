import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewOrderForm } from "./new-order-form";

export default async function NewPartnerOrderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "REVENDEUR") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Réservé aux revendeurs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Vous n'avez pas accès à la saisie de commandes.</p>
        </CardContent>
      </Card>
    );
  }
  if (partner.status !== "ACTIVE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compte non actif</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Votre compte partenaire doit être actif pour saisir des commandes. Contactez AFRYNTIX.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calendrier d'envois disponible (réservations possibles)
  const schedules = await prisma.shippingSchedule.findMany({
    where: { active: true, cutoffDate: { gt: new Date() } },
    orderBy: { departureDate: "asc" },
    take: 20,
    select: { id: true, mode: true, destination: true, departureDate: true, cutoffDate: true },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/partner/orders" className="text-xs text-muted-foreground hover:underline">← Mes commandes</Link>
          <h1 className="text-xl font-semibold mt-1">Nouvelle commande pour un client</h1>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <NewOrderForm schedules={schedules.map((s) => ({
            id: s.id,
            mode: s.mode,
            destination: s.destination,
            departureDate: s.departureDate.toISOString(),
            cutoffDate: s.cutoffDate.toISOString(),
          }))} />
        </CardContent>
      </Card>
    </div>
  );
}
