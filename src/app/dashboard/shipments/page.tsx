import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { ShipmentStatusBadge, PaymentStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatXOF, formatDate } from "@/lib/utils";

export default async function ClientShipmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Colis du client via son compte
  const shipments = await prisma.shipment.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      facture: { select: { id: true, reference: true, status: true, totalAmount: true, amountPaid: true, remainingAmount: true } },
      envoi: { select: { reference: true, status: true } },
    },
  });

  // Factures liées au client (directement ou via ShippingMark)
  const shippingMark = await prisma.shippingMark.findUnique({
    where: { userId: session.user.id },
    include: {
      factures: {
        orderBy: { createdAt: "desc" },
        include: {
          shipments: {
            select: { id: true, trackingNumber: true, mode: true, status: true, description: true, totalAmount: true },
          },
          envoi: { select: { reference: true } },
        },
      },
    },
  });

  const factures = shippingMark?.factures ?? [];
  const pendingFactures = factures.filter((f) => f.status !== "FULLY_PAID" && f.status !== "REFUNDED");

  return (
    <div className="space-y-6">
      {/* Factures en attente de paiement */}
      {pendingFactures.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Factures en attente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingFactures.map((facture) => (
              <div key={facture.id} className="rounded-md border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-mono text-sm font-semibold">{facture.reference}</div>
                    {facture.envoi && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Envoi : {facture.envoi.reference}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-destructive">{formatXOF(facture.remainingAmount)} restants</div>
                    <div className="text-xs text-muted-foreground">
                      Total : {formatXOF(facture.totalAmount)}
                      {facture.amountPaid > 0 && ` · Payé : ${formatXOF(facture.amountPaid)}`}
                    </div>
                  </div>
                </div>
                <div className="divide-y border rounded-md bg-background">
                  {facture.shipments.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                      <Link href={`/tracking/${s.trackingNumber}`} className="font-mono text-primary hover:underline shrink-0">
                        {s.trackingNumber}
                      </Link>
                      <span className="text-muted-foreground text-xs truncate">{s.description || TRANSPORT_MODE_LABELS[s.mode]}</span>
                      <ShipmentStatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pour régler cette facture, contactez AFRYNTIX Abidjan au +225 07 06 26 04 05
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Toutes les expéditions */}
      <Card>
        <CardHeader>
          <CardTitle>Mes expéditions ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {shipments.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Aucune expédition.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium">Tracking</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                  <th className="text-left px-4 py-2 font-medium">Statut</th>
                  <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Facture</th>
                  <th className="text-right px-4 py-2 font-medium">Montant</th>
                  <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono">
                      <Link href={`/tracking/${s.trackingNumber}`} className="text-primary hover:underline">
                        {s.trackingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{TRANSPORT_MODE_LABELS[s.mode]}</td>
                    <td className="px-4 py-2">
                      <ShipmentStatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      {s.facture ? (
                        <div>
                          <span className="font-mono text-xs">{s.facture.reference}</span>
                          <div className="mt-0.5">
                            <PaymentStatusBadge status={s.facture.status} />
                          </div>
                        </div>
                      ) : (
                        <PaymentStatusBadge status={s.paymentStatus} />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="font-medium">{formatXOF(s.totalAmount)}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
