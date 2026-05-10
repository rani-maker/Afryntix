import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShipmentStatusBadge, PaymentStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { StatusUpdateForm, RecordPaymentForm } from "./forms";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      client: true,
      history: { orderBy: { createdAt: "desc" } },
      envoi: { select: { id: true, reference: true } },
      container: { select: { refInternal: true, carrierNumber: true } },
    },
  });
  if (!shipment) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/staff/shipments" className="text-xs text-muted-foreground hover:text-primary">
            ← Retour aux expéditions
          </Link>
          <h2 className="text-2xl font-bold font-mono mt-1">{shipment.trackingNumber}</h2>
        </div>
        <div className="flex items-center gap-2">
          <ShipmentStatusBadge status={shipment.status} />
          <PaymentStatusBadge status={shipment.paymentStatus} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/print/shipment-label/${shipment.id}`} target="_blank">
              <Printer className="h-4 w-4" /> Étiquette
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails du colis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Client"
              value={
                shipment.client
                  ? `${shipment.client.name} (${shipment.client.email})`
                  : `${shipment.clientName ?? "—"}${shipment.clientPhone ? ` (${shipment.clientPhone})` : ""} · sans compte`
              }
            />
            <Row label="Mode" value={TRANSPORT_MODE_LABELS[shipment.mode]} />
            <Row label="Catégorie" value={CARGO_CATEGORY_LABELS[shipment.category]} />
            <Row label="Pièces" value={String(shipment.pieces)} />
            {shipment.weightKg != null && <Row label="Poids réel" value={`${shipment.weightKg} kg`} />}
            {shipment.volumetricWeight != null && (
              <Row label="Poids volumique" value={`${shipment.volumetricWeight.toFixed(2)} kg`} />
            )}
            {shipment.volumeCBM != null && <Row label="Volume" value={`${shipment.volumeCBM.toFixed(3)} m³`} />}
            {shipment.destinationCity && <Row label="Destination" value={`${shipment.destinationCity}, ${shipment.destinationCountry ?? ""}`} />}
            {shipment.recipientName && <Row label="Receveur" value={shipment.recipientName} />}
            {shipment.recipientPhone && <Row label="Téléphone" value={shipment.recipientPhone} />}
            {shipment.envoi && (
              <div className="flex items-baseline gap-2 py-1 border-t pt-3 mt-3">
                <span className="text-xs uppercase text-muted-foreground w-32 shrink-0">Envoi</span>
                <Link href={`/staff/envois/${shipment.envoi.id}`} className="text-sm font-mono text-primary hover:underline">
                  {shipment.envoi.reference}
                </Link>
              </div>
            )}
            {shipment.container && (
              <Row
                label="Conteneur"
                value={`${shipment.container.refInternal}${shipment.container.carrierNumber ? ` · ${shipment.container.carrierNumber}` : ""}`}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarification & Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Prix unitaire" value={shipment.unitPrice ? formatXOF(shipment.unitPrice) : "—"} />
            <Row label="Total" value={formatXOF(shipment.totalAmount)} />
            <Row label="Acompte 50%" value={formatXOF(shipment.depositAmount)} />
            <Row label="Solde 50%" value={formatXOF(shipment.remainingAmount)} />
            <Row label="Déjà encaissé" value={formatXOF(shipment.amountPaid)} />
            <div className="pt-3">
              <RecordPaymentForm shipmentId={shipment.id} maxAmount={shipment.totalAmount - shipment.amountPaid} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mettre à jour le statut</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusUpdateForm shipmentId={shipment.id} currentStatus={shipment.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {shipment.history.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/20 pl-4 py-1">
                <div className="text-sm">
                  <ShipmentStatusBadge status={h.status} />
                  <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
                {(h.location || h.note) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {h.location && <span>📍 {h.location} </span>}
                    {h.note && <span>— {h.note}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
