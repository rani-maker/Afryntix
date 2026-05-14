import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getActiveStorageSetting } from "@/server/actions/storage";
import { StorageSettingForm } from "./form";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { computeStorageFee } from "@/lib/storage-fees";
import Link from "next/link";

export default async function AdminStoragePage() {
  const setting = await getActiveStorageSetting();

  // Colis disponibles depuis longtemps (potentiellement à facturer)
  const pending = await prisma.shipment.findMany({
    where: {
      status: "AVAILABLE_FOR_DELIVERY",
      availableSinceAt: { not: null },
    },
    select: {
      id: true,
      trackingNumber: true,
      availableSinceAt: true,
      storageFeeAmount: true,
      storageChargedAt: true,
      client: { select: { name: true } },
      clientName: true,
    },
    orderBy: { availableSinceAt: "asc" },
    take: 200,
  });

  const now = new Date();
  const rows = pending.map((s) => {
    const quote = computeStorageFee({
      availableSinceAt: s.availableSinceAt,
      asOf: now,
      freeDays: setting.freeDays,
      dailyRateXOF: setting.dailyRateXOF,
    });
    return { ...s, quote };
  });

  const overdue = rows.filter((r) => r.quote.billableDays > 0).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres d&apos;entreposage</CardTitle>
          <CardDescription>
            Les frais d&apos;entreposage démarrent à la date où le colis devient disponible pour livraison (statut
            AVAILABLE_FOR_DELIVERY). Pendant le free-time, aucun frais. Ensuite, tarif par jour entamé et par colis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StorageSettingForm
            initial={{
              freeDays: setting.freeDays,
              dailyRateXOF: setting.dailyRateXOF,
              notes: setting.notes ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colis en attente de retrait ({rows.length})</CardTitle>
          <CardDescription>
            {overdue > 0
              ? `${overdue} colis hors free-time, frais à facturer.`
              : "Aucun colis hors free-time pour l'instant."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Disponible depuis</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Jours facturables</TableHead>
                <TableHead>Frais en cours</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucun colis en attente.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/staff/shipments/${r.id}`} className="hover:text-primary">
                        {r.trackingNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.client?.name ?? r.clientName ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.availableSinceAt ? formatDateTime(r.availableSinceAt) : "—"}
                    </TableCell>
                    <TableCell>{r.quote.daysSinceAvailable}</TableCell>
                    <TableCell>{r.quote.billableDays}</TableCell>
                    <TableCell className="font-medium">{formatXOF(r.quote.amount)}</TableCell>
                    <TableCell>
                      {r.storageChargedAt ? (
                        <Badge variant="success">Facturé ({formatXOF(r.storageFeeAmount ?? 0)})</Badge>
                      ) : r.quote.billableDays > 0 ? (
                        <Badge variant="warning">À facturer</Badge>
                      ) : (
                        <Badge variant="secondary">Free-time</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
