import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";

export default async function StaffSchedulesPage() {
  const schedules = await prisma.shippingSchedule.findMany({
    orderBy: { departureDate: "asc" },
    include: { _count: { select: { reservations: true } } },
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
              schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[s.mode]}</TableCell>
                  <TableCell className="text-sm">
                    {s.origin} → {s.destination}
                  </TableCell>
                  <TableCell>{formatDate(s.cutoffDate)}</TableCell>
                  <TableCell>{formatDate(s.departureDate)}</TableCell>
                  <TableCell>{s.arrivalDate ? formatDate(s.arrivalDate) : "—"}</TableCell>
                  <TableCell className="text-xs">{s.capacity ?? "—"}</TableCell>
                  <TableCell className="text-center">{s._count.reservations}</TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Désactivé</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
