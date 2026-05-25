import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatXOF } from "@/lib/utils";

export default async function PartnerShipmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) redirect("/partner");

  const shipments = await prisma.shipment.findMany({
    where: { referredByPartnerId: partner.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      trackingNumber: true,
      mode: true,
      totalAmount: true,
      paymentStatus: true,
      status: true,
      partnerCommission: true,
      partnerCommissionPaid: true,
      destinationCity: true,
      recipientName: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tous les colis apportés ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Statut colis</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Aucun colis pour l'instant.
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-sm">{s.mode}</TableCell>
                    <TableCell className="text-sm">{s.recipientName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.destinationCity ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={s.paymentStatus === "FULLY_PAID" ? "success" : "warning"}>
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatXOF(s.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      {s.partnerCommission != null ? (
                        <span className={s.partnerCommissionPaid ? "text-emerald-700 font-medium" : ""}>
                          {formatXOF(s.partnerCommission)}
                          {s.partnerCommissionPaid && " ✓"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">en attente</span>
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
