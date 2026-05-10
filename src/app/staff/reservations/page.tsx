import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";
import { ReservationActions } from "./row-actions";

export default async function StaffReservationsPage() {
  const rows = await prisma.reservation.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { client: true },
    take: 100,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réservations à traiter</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Mode / Catégorie</TableHead>
              <TableHead>Suivi fournisseur</TableHead>
              <TableHead>Estimations</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Reçue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Aucune réservation.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.client.name}</div>
                    <div className="text-xs text-muted-foreground">{r.client.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</div>
                    <div className="text-xs text-muted-foreground">{CARGO_CATEGORY_LABELS[r.category]}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.supplierTrackingNumber}</TableCell>
                  <TableCell className="text-xs">
                    {r.estimatedWeightKg ? `${r.estimatedWeightKg} kg` : ""}
                    {r.estimatedVolumeCBM ? ` • ${r.estimatedVolumeCBM} m³` : ""}
                  </TableCell>
                  <TableCell>
                    {r.photoUrl ? (
                      <a href={r.photoUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
                        Voir
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <ReservationActions
                      id={r.id}
                      status={r.status}
                      mode={r.mode}
                      category={r.category}
                      clientId={r.clientId}
                      supplierTrackingNumber={r.supplierTrackingNumber}
                      estimatedWeightKg={r.estimatedWeightKg}
                      estimatedVolumeCBM={r.estimatedVolumeCBM}
                    />
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
