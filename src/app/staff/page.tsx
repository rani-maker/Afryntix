import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Package, ClipboardList, CreditCard, AlertTriangle, Plus } from "lucide-react";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";

export default async function StaffOverview() {
  const [pendingReservations, todoShipments, todoPayments, recent] = await Promise.all([
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.shipment.count({
      where: { status: { in: ["REGISTERED", "RECEIVED_CHINA", "IN_TRANSIT", "ARRIVED_DESTINATION", "CUSTOMS_CLEARANCE"] } },
    }),
    prisma.billPayment.count({ where: { status: { in: ["PENDING", "WITHDRAWAL_CODE_SENT"] } } }),
    prisma.shipment.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, email: true } } },
    }),
  ]);

  const todaysExchangeCount = await prisma.exchangeRate.count({
    where: { date: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Vos opérations du jour</div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/staff/shipments/new">
              <Plus className="h-4 w-4" /> Nouvelle expédition
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/payments/new">
              <Plus className="h-4 w-4" /> Nouveau transfert
            </Link>
          </Button>
        </div>
      </div>

      {todaysExchangeCount === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-amber-900">
                Taux de change du jour non défini
              </div>
              <div className="text-amber-800 mt-1">
                Demandez à l'administrateur de définir le taux pour autoriser les transferts d'argent.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          label="Réservations à valider"
          value={pendingReservations}
          tone="warning"
          icon={<ClipboardList />}
        />
        <StatsCard
          label="Expéditions en cours"
          value={todoShipments}
          tone="info"
          icon={<Package />}
        />
        <StatsCard
          label="Transferts en cours"
          value={todoPayments}
          tone="warning"
          icon={<CreditCard />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dernières expéditions</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/staff/shipments">Tout voir</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ShipmentsTable
            rows={recent}
            showClient
            manageHref={(id) => `/staff/shipments/${id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
