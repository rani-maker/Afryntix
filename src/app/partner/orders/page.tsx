import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "warning",
  VALIDATED: "success",
  REJECTED: "destructive",
  RECEIVED: "info" as never,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  REJECTED: "Rejetée",
  RECEIVED: "Colis reçu",
};

export default async function PartnerOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "REVENDEUR") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section réservée aux revendeurs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette page n'est disponible que pour les partenaires de type « Revendeur ».
          </p>
        </CardContent>
      </Card>
    );
  }

  const reservations = await prisma.reservation.findMany({
    where: { createdByPartnerId: partner.id },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, phone: true } },
      shipment: { select: { trackingNumber: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Mes commandes</h1>
          <p className="text-sm text-muted-foreground">
            Saisies pour le compte de vos clients. AFRYNTIX prend le relais pour la prise en charge en Chine.
          </p>
        </div>
        <Button asChild>
          <Link href="/partner/orders/new">+ Nouvelle commande</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique ({reservations.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>N° fournisseur</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Tracking colis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune commande pour l'instant. <Link href="/partner/orders/new" className="text-primary hover:underline">Créer la première</Link>.
                  </TableCell>
                </TableRow>
              ) : (
                reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.client?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.client?.phone ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                    <TableCell className="font-mono text-xs">{r.supplierTrackingNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.recipientName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{STATUS_LABELS[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.shipment?.trackingNumber ?? "—"}</TableCell>
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
