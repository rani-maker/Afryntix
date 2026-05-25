import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { ConfirmDeliveryButton } from "./confirm-delivery-button";

export default async function PartnerDeliveriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "TRANSPORTEUR_RELAIS") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section réservée aux transporteurs relais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette page n'est disponible que pour les partenaires de type « Transporteur relais ».
          </p>
        </CardContent>
      </Card>
    );
  }

  const [pending, completed] = await Promise.all([
    prisma.shipment.findMany({
      where: { lastMilePartnerId: partner.id, lastMileSettled: false },
      orderBy: { lastMileAssignedAt: "desc" },
      select: {
        id: true,
        trackingNumber: true,
        mode: true,
        destinationCity: true,
        recipientName: true,
        recipientPhone: true,
        recipientAddress: true,
        lastMileAmount: true,
        lastMileAssignedAt: true,
        status: true,
      },
    }),
    prisma.shipment.findMany({
      where: { lastMilePartnerId: partner.id, lastMileSettled: true },
      orderBy: { lastMileDeliveredAt: "desc" },
      take: 50,
      select: {
        id: true,
        trackingNumber: true,
        destinationCity: true,
        recipientName: true,
        lastMileAmount: true,
        lastMileDeliveredAt: true,
      },
    }),
  ]);

  const totalPending = pending.reduce((s, x) => s + (x.lastMileAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Livraisons à effectuer</div>
            <div className="text-2xl font-semibold mt-1">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Montant à gagner</div>
            <div className="text-2xl font-semibold mt-1 text-amber-700">{formatXOF(totalPending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Livraisons effectuées</div>
            <div className="text-2xl font-semibold mt-1">{completed.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colis à livrer ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Assigné le</TableHead>
                <TableHead className="text-right">Rémunération</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucune livraison en cours.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{s.recipientName ?? "—"}</div>
                      <a
                        href={s.recipientPhone ? `tel:${s.recipientPhone}` : undefined}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {s.recipientPhone ?? "—"}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{s.destinationCity ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.recipientAddress ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastMileAssignedAt ? formatDateTime(s.lastMileAssignedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatXOF(s.lastMileAmount ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      <ConfirmDeliveryButton shipmentId={s.id} trackingNumber={s.trackingNumber} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Livraisons effectuées (50 dernières)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Livré le</TableHead>
                <TableHead className="text-right">Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Aucune livraison effectuée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                completed.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell className="text-sm">{s.recipientName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.destinationCity ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastMileDeliveredAt ? formatDateTime(s.lastMileDeliveredAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">
                      {formatXOF(s.lastMileAmount ?? 0)} ✓
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
