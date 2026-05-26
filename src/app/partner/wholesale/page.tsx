import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatXOF } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  AIR_EXPRESS: "Aérien Express",
  AIR_NORMAL: "Aérien Normal",
  SEA_LCL: "Maritime LCL",
  SEA_FCL: "Maritime FCL",
  VEHICLE: "Véhicule",
  BTP_EQUIPMENT: "BTP",
  STORAGE: "Entreposage",
};

export default async function ForwarderWholesalePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true, commissionModel: true, commissionRate: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "CONFRERE_FORWARDER") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section réservée aux confrères forwarders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette page n'est disponible que pour les partenaires de type « Confrère forwarder ».
          </p>
        </CardContent>
      </Card>
    );
  }

  const shipments = await prisma.shipment.findMany({
    where: { referredByPartnerId: partner.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      trackingNumber: true,
      mode: true,
      destinationCity: true,
      recipientName: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      depositAmount: true,
      amountPaid: true,
      remainingAmount: true,
      createdAt: true,
      envoi: { select: { reference: true } },
    },
  });

  const totalBilled = shipments.reduce((s, x) => s + x.totalAmount, 0);
  const totalPaid = shipments.reduce((s, x) => s + x.amountPaid, 0);
  const totalRemaining = totalBilled - totalPaid;

  const discount =
    partner.commissionModel === "WHOLESALE_TARIFF" && partner.commissionRate
      ? partner.commissionRate
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mes envois gros</h1>
          <p className="text-sm text-muted-foreground">
            Vos colis traités au tarif négocié — remise <strong>{discount}%</strong> sur le tarif public AFRYNTIX
          </p>
        </div>
        <Button asChild>
          <Link href="/partner/wholesale/new">+ Nouveau colis</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Colis créés</div>
            <div className="text-2xl font-semibold mt-1">{shipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total facturé (gros)</div>
            <div className="text-2xl font-semibold mt-1">{formatXOF(totalBilled)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Payé</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-700">{formatXOF(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className={totalRemaining > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">À régler</div>
            <div className={`text-2xl font-semibold mt-1 ${totalRemaining > 0 ? "text-amber-700" : ""}`}>
              {formatXOF(totalRemaining)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Envoi</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Total gros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Aucun colis. <Link href="/partner/wholesale/new" className="text-primary hover:underline">Créer le premier</Link>.
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-sm">{MODE_LABELS[s.mode] ?? s.mode}</TableCell>
                    <TableCell className="text-sm">
                      <div>{s.recipientName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.destinationCity ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">{s.envoi?.reference ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={s.paymentStatus === "FULLY_PAID" ? "success" : "warning"}>
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatXOF(s.totalAmount)}</TableCell>
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
