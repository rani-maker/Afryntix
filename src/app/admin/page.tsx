import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, ClipboardList, CreditCard, Banknote, AlertCircle } from "lucide-react";
import { ShipmentStatusBadge, ReservationStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatXOF, formatDateTime } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const [
    totalShipments,
    totalClients,
    totalStaff,
    pendingReservations,
    pendingPayments,
    revenueAgg,
    recentShipments,
    recentReservations,
    todaysExchangeCount,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: "STAFF" } }),
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.billPayment.count({ where: { status: { in: ["PENDING", "WITHDRAWAL_CODE_SENT"] } } }),
    prisma.shipment.aggregate({ _sum: { amountPaid: true, totalAmount: true } }),
    prisma.shipment.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.reservation.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.exchangeRate.count({
      where: {
        date: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      {todaysExchangeCount === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-amber-900">
                Aucun taux de change défini pour aujourd'hui
              </div>
              <div className="text-amber-800 mt-1">
                Les transferts d'argent et paiements de factures nécessitent un taux du jour.
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/exchange-rates">Définir le taux</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard label="Expéditions" value={totalShipments} icon={<Package />} />
        <StatsCard label="Clients" value={totalClients} icon={<Users />} tone="info" />
        <StatsCard label="Staff" value={totalStaff} icon={<Users />} tone="info" />
        <StatsCard
          label="Réservations en attente"
          value={pendingReservations}
          tone="warning"
          icon={<ClipboardList />}
        />
        <StatsCard
          label="Paiements en cours"
          value={pendingPayments}
          tone="warning"
          icon={<CreditCard />}
        />
        <StatsCard
          label="CA encaissé"
          value={formatXOF(revenueAgg._sum.amountPaid ?? 0)}
          hint={`Total facturé : ${formatXOF(revenueAgg._sum.totalAmount ?? 0)}`}
          tone="success"
          icon={<Banknote />}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dernières expéditions</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/shipments">Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentShipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune expédition.</p>
            ) : (
              recentShipments.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <Link
                      href={`/tracking/${s.trackingNumber}`}
                      className="font-mono font-medium hover:text-primary"
                    >
                      {s.trackingNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {s.client?.name ?? "Client sans compte"} • {TRANSPORT_MODE_LABELS[s.mode]}
                    </div>
                  </div>
                  <div className="text-right">
                    <ShipmentStatusBadge status={s.status} />
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(s.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Réservations récentes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/reservations">Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réservation.</p>
            ) : (
              recentReservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <div className="font-medium">{r.client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {TRANSPORT_MODE_LABELS[r.mode]} • {r.supplierTrackingNumber || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <ReservationStatusBadge status={r.status} />
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(r.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
