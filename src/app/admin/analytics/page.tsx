import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatXOF } from "@/lib/utils";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import type { TransportMode } from "@prisma/client";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AdminAnalyticsPage() {
  const since30 = daysAgo(30);
  const since90 = daysAgo(90);

  const [shipments30, shipmentsDelivered, byMode30, claims30, byClient30] = await Promise.all([
    prisma.shipment.findMany({
      where: { createdAt: { gte: since30 } },
      select: { totalAmount: true, weightKg: true, volumeCBM: true, mode: true, clientId: true, status: true },
    }),
    prisma.shipment.findMany({
      where: { deliveredAt: { not: null, gte: since90 }, createdAt: { gte: since90 } },
      select: { createdAt: true, deliveredAt: true, mode: true },
    }),
    prisma.shipment.groupBy({
      by: ["mode"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      _sum: { totalAmount: true, weightKg: true, volumeCBM: true },
    }),
    prisma.claim.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.shipment.groupBy({
      by: ["clientId"],
      where: { createdAt: { gte: since30 }, clientId: { not: null } },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    }),
  ]);

  // KPI
  const totalRevenue30 = shipments30.reduce((s, x) => s + x.totalAmount, 0);
  const totalWeight30 = shipments30.reduce((s, x) => s + (x.weightKg ?? 0), 0);
  const totalCBM30 = shipments30.reduce((s, x) => s + (x.volumeCBM ?? 0), 0);

  // Délai moyen porte-à-porte (livraison) par mode
  const leadTimeByMode = new Map<TransportMode, { days: number[]; }>();
  for (const s of shipmentsDelivered) {
    if (!s.deliveredAt) continue;
    const days = (s.deliveredAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const k = s.mode;
    if (!leadTimeByMode.has(k)) leadTimeByMode.set(k, { days: [] });
    leadTimeByMode.get(k)!.days.push(days);
  }
  const leadTimeRows = [...leadTimeByMode.entries()].map(([mode, v]) => ({
    mode,
    count: v.days.length,
    avgDays: v.days.length ? v.days.reduce((a, b) => a + b, 0) / v.days.length : 0,
    minDays: v.days.length ? Math.min(...v.days) : 0,
    maxDays: v.days.length ? Math.max(...v.days) : 0,
  }));

  // Top clients enrichi avec nom
  const clientIds = byClient30.map((r) => r.clientId!).filter(Boolean);
  const clientsLookup = await prisma.user.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, email: true },
  });
  const lookup = new Map(clientsLookup.map((c) => [c.id, c]));

  // Taux de remplissage container (basé sur le rapport CBM utilisé / CBM théorique 67 m³ pour 40HQ)
  const seaShipments = shipments30.filter((s) => s.mode === "SEA_LCL" || s.mode === "SEA_FCL");
  const seaCBM = seaShipments.reduce((s, x) => s + (x.volumeCBM ?? 0), 0);

  const totalClaims = claims30.reduce((s, c) => s + c._count._all, 0);
  const claimRate = shipments30.length > 0 ? (totalClaims / shipments30.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics — 30 derniers jours</CardTitle>
          <CardDescription>Vue avancée pour le pilotage opérationnel.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="CA 30j" value={formatXOF(totalRevenue30)} />
        <KPI label="Colis créés" value={shipments30.length.toString()} />
        <KPI label="Poids transporté" value={`${totalWeight30.toFixed(0)} kg`} />
        <KPI label="Volume transporté" value={`${totalCBM30.toFixed(1)} m³`} />
        <KPI label="CBM maritime 30j" value={`${seaCBM.toFixed(2)} m³`} />
        <KPI label="Réclamations 30j" value={totalClaims.toString()} />
        <KPI label="Taux de réclamation" value={`${claimRate.toFixed(1)} %`} tone={claimRate > 5 ? "warning" : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 clients (30j)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Colis</TableHead>
                <TableHead>CA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byClient30.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucune donnée.</TableCell></TableRow>
              ) : byClient30.map((r, i) => {
                const c = r.clientId ? lookup.get(r.clientId) : null;
                return (
                  <TableRow key={r.clientId ?? i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c?.email}</div>
                    </TableCell>
                    <TableCell>{r._count._all}</TableCell>
                    <TableCell className="font-medium">{formatXOF(r._sum.totalAmount ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Répartition CA par mode (30j)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Colis</TableHead>
                <TableHead>Poids (kg)</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>CA</TableHead>
                <TableHead>Part %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byMode30.map((r) => {
                const share = totalRevenue30 > 0 ? ((r._sum.totalAmount ?? 0) / totalRevenue30) * 100 : 0;
                return (
                  <TableRow key={r.mode}>
                    <TableCell>{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                    <TableCell>{r._count._all}</TableCell>
                    <TableCell>{(r._sum.weightKg ?? 0).toFixed(1)}</TableCell>
                    <TableCell>{(r._sum.volumeCBM ?? 0).toFixed(3)}</TableCell>
                    <TableCell className="font-medium">{formatXOF(r._sum.totalAmount ?? 0)}</TableCell>
                    <TableCell>{share.toFixed(1)} %</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Délai moyen porte-à-porte (90j)</CardTitle>
          <CardDescription>Calculé depuis la création jusqu&apos;à la livraison effective (DELIVERED).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Colis livrés</TableHead>
                <TableHead>Délai moyen (j)</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadTimeRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Pas encore de colis livrés sur 90j.</TableCell></TableRow>
              ) : leadTimeRows.map((r) => (
                <TableRow key={r.mode}>
                  <TableCell>{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell className="font-medium">{r.avgDays.toFixed(1)}</TableCell>
                  <TableCell>{r.minDays.toFixed(1)}</TableCell>
                  <TableCell>{r.maxDays.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold mt-1 ${tone === "warning" ? "text-amber-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
