import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import { ScheduleForm } from "./schedule-form";
import { ScheduleRowActions } from "./row-actions";
import {
  computeOccupancy,
  getCapacityUnit,
  CAPACITY_UNIT_LABEL,
  formatCapacity,
} from "@/lib/schedule-capacity";

export default async function AdminSchedulesPage() {
  const schedules = await prisma.shippingSchedule.findMany({
    orderBy: { departureDate: "asc" },
    // Pour calculer l'occupation, on a besoin des dimensions de chaque réservation
    // active. On exclut les rejets, qui ne consomment plus de capacité.
    include: {
      reservations: {
        where: { status: { not: "REJECTED" } },
        select: { estimatedWeightKg: true, estimatedVolumeCBM: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publier un calendrier d'envoi</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendrier ({schedules.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Origine → Destination</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée prévue</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead className="text-center">Réservations</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Aucun calendrier publié.
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
                    <TableCell>{formatDate(s.departureDate)}</TableCell>
                    <TableCell>{s.arrivalDate ? formatDate(s.arrivalDate) : "—"}</TableCell>
                    <TableCell>{formatDate(s.cutoffDate)}</TableCell>
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
                        <span>
                          {s.reservations.length} résa
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ScheduleRowActions id={s.id} active={s.active} />
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
