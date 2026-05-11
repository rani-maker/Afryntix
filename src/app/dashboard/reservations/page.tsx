import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";

export default async function ClientReservationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rows = await prisma.reservation.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { schedule: true, shipment: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mes réservations</h2>
          <p className="text-sm text-muted-foreground">
            Réservez une place sur un prochain envoi en fournissant le n° de suivi du fournisseur en Chine.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/dashboard/reservations/new">+ Nouvelle réservation</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode / Catégorie</TableHead>
                <TableHead>Suivi fournisseur</TableHead>
                <TableHead>Estimations</TableHead>
                <TableHead>Calendrier</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Expédition</TableHead>
                <TableHead>Créée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucune réservation. Cliquez sur « Nouvelle réservation » pour démarrer.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</div>
                      <div className="text-xs text-muted-foreground">{CARGO_CATEGORY_LABELS[r.category]}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.supplierTrackingNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.estimatedWeightKg ? `${r.estimatedWeightKg} kg` : ""}
                      {r.estimatedVolumeCBM ? ` • ${r.estimatedVolumeCBM} m³` : ""}
                      {!r.estimatedWeightKg && !r.estimatedVolumeCBM ? "—" : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.schedule ? `${TRANSPORT_MODE_LABELS[r.schedule.mode]} → ${r.schedule.destination}` : "—"}
                    </TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={r.status} />
                      {r.rejectionReason && (
                        <div className="text-xs text-destructive mt-1">{r.rejectionReason}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.shipment ? (
                        <Link href={`/tracking/${r.shipment.trackingNumber}`} className="text-primary hover:underline">
                          {r.shipment.trackingNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
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
