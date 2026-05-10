import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ServiceRowActions } from "./row-actions";

const TYPE_LABELS: Record<string, string> = {
  QUALITY_CONTROL: "Contrôle qualité",
  PURCHASING: "Achat / Sourcing",
  VEHICLE_SALE: "Achat véhicule",
  BTP_SALE: "Achat engin BTP",
  TRADING: "Paiement de facture",
  INTRODUCTION: "Négoce",
};

export default async function StaffServicesPage() {
  const requests = await prisma.serviceRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demandes de service ({requests.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Reçu</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Aucune demande pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell>
                    <Badge variant="info">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.clientPhone}
                      {r.clientEmail ? ` • ${r.clientEmail}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs line-clamp-3">{r.message}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.budget ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "COMPLETED" ? "success" : r.status === "CANCELLED" ? "destructive" : "warning"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <ServiceRowActions id={r.id} status={r.status} />
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
