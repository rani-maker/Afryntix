import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import {
  computeOccupancy,
  getCapacityUnit,
  CAPACITY_UNIT_LABEL,
  formatCapacity,
} from "@/lib/schedule-capacity";

export default async function StaffSchedulesPage() {
  const schedules = await prisma.shippingSchedule.findMany({
    orderBy: { departureDate: "asc" },
    // Idem admin : on calcule l'occupation à partir des dimensions estimées
    // des réservations non rejetées.
    include: {
      reservations: {
        where: { status: { not: "REJECTED" } },
        select: { estimatedWeightKg: true, estimatedVolumeCBM: true },
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendrier des envois ({schedules.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mode</TableHead>
              <TableHead>Origine → Destination</TableHead>
              <TableHead>Cutoff</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Arrivée prévue</TableHead>
              <TableHead>Capacité</TableHead>
              <TableHead className="text-center">Réservations</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Aucun calendrier publié — l'admin doit en créer un.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((s) => {
                const occ = computeOccupancy(s.capacityValue, s.reservations, s.mode);
                const unit = CAPACITY_UNIT_LABEL[getCapacityUnit(s.mode)];
                return (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[s.mode]}</TableCell>
                  <TableCell className="text-sm">
                    {s.origin} → {s.destination}
                  </TableCell>
                  <TableCell>{formatDate(s.cutoffDate)}</TableCell>
                  <TableCell>{formatDate(s.departureDate)}</TableCell>
                  <TableCell>{s.arrivalDate ? formatDate(s.arrivalDate) : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {s.capacity ?? "—"}
                    {s.capacityValue != null && (
                      <div className="text-[11px] text-muted-foreground">
                        Plafond : {formatCapacity(s.capacityValue, s.mode)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {occ ? (
                      <span
                        className={
                          occ.isFull
                            ? "text-destructive font-semibold"
                            : occ.percent >= 80
                            ? "text-amber-600 font-medium"
                            : ""
                        }
                      >
                        {occ.used.toFixed(2)} / {occ.capacity.toFixed(2)} {unit}
                        <div className="text-[11px] font-normal">
                          ({s.reservations.length} résa · {occ.percent}%)
                        </div>
                        {occ.isFull && (
                          <div className="text-[11px]">Complet</div>
                        )}
                      </span>
                    ) : (
                      <span>{s.reservations.length} résa</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Désactivé</Badge>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
