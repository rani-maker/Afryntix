import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CARGO_CATEGORY_LABELS, SHIPMENT_STATUS_LABELS, TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { TrackingMap } from "@/components/tracking/tracking-map";

const STATUS_ORDER = [
  "REGISTERED",
  "RECEIVED_CHINA",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "AVAILABLE_FOR_DELIVERY",
  "DELIVERED",
] as const;

const TRANSIT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  REGISTERED: { label: "ENREGISTRÉ", bg: "var(--afx-bg-2)", color: "var(--afx-ink-2)" },
  RECEIVED_CHINA: { label: "REÇU EN CHINE", bg: "var(--afx-night-soft)", color: "var(--afx-ink)" },
  IN_TRANSIT: { label: "EN TRANSIT", bg: "var(--afx-mint-soft)", color: "var(--afx-mint-3)" },
  ARRIVED_DESTINATION: { label: "ARRIVÉ", bg: "var(--afx-night-soft)", color: "var(--afx-ink)" },
  CUSTOMS_CLEARANCE: { label: "DOUANE", bg: "var(--afx-night-soft)", color: "var(--afx-ink)" },
  AVAILABLE_FOR_DELIVERY: { label: "PRÊT À RETIRER", bg: "var(--afx-mint-soft)", color: "var(--afx-mint-3)" },
  DELIVERED: { label: "LIVRÉ", bg: "var(--afx-mint)", color: "var(--afx-ink)" },
};

export default async function TrackingDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: number },
    include: {
      client: { select: { name: true } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!shipment) notFound();

  const currentIndex = STATUS_ORDER.indexOf(shipment.status as (typeof STATUS_ORDER)[number]);
  const badge = TRANSIT_BADGE[shipment.status] ?? TRANSIT_BADGE.REGISTERED;
  const route = [
    shipment.originCity ?? "Guangzhou",
    [shipment.destinationCity, shipment.destinationCountry].filter(Boolean).join(", ") || "Afrique de l'Ouest",
  ].join(" → ");

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/tracking" />

      <section className="container px-4 md:px-8 py-6 md:py-10 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="afx-kicker">SUIVI · {route}</span>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight break-all">
              {shipment.trackingNumber}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap"
              style={{ background: badge.bg, color: badge.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {badge.label}
            </span>
            <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
              <Link href="/tracking">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle recherche
              </Link>
            </Button>
          </div>
        </div>

        {/* Rangée du haut : carte + timeline */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4 md:gap-6 mb-4 md:mb-6">
          <div className="rounded-2xl border border-line bg-surface overflow-hidden min-w-0">
            <TrackingMap
              originCity={shipment.originCity}
              destinationCity={shipment.destinationCity}
              destinationCountry={shipment.destinationCountry}
              status={shipment.status}
              mode={shipment.mode}
              trackingNumber={shipment.trackingNumber}
            />
          </div>

          <aside className="flex flex-col gap-3 min-w-0">
            <div className="rounded-2xl border border-line bg-surface p-5 lg:max-h-[480px] lg:overflow-y-auto">
              <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>ÉTAPES</span>
              <div className="mt-4 flex flex-col gap-4">
                {STATUS_ORDER.map((status, idx, arr) => {
                  const reached = currentIndex >= idx;
                  const current = currentIndex === idx;
                  const evt = shipment.history.find((h) => h.status === status);
                  const dotState = current ? "now" : reached ? "done" : "";
                  const isLast = idx === arr.length - 1;
                  const lineColor = reached
                    ? "var(--afx-mint-3)"
                    : current
                      ? "linear-gradient(180deg, var(--afx-night), var(--afx-line-2))"
                      : "var(--afx-line)";
                  return (
                    <div key={status} className="relative flex gap-3.5">
                      {!isLast && (
                        <div
                          className="absolute"
                          style={{
                            left: 6,
                            top: 18,
                            bottom: -20,
                            width: 2,
                            background: lineColor,
                          }}
                        />
                      )}
                      <div className={`afx-step-dot ${dotState} mt-0.5 z-[1]`} />
                      <div className="flex-1 flex flex-col gap-1">
                        <span
                          className={`text-sm font-semibold ${
                            reached || current ? "text-ink" : "text-ink-3"
                          }`}
                        >
                          {SHIPMENT_STATUS_LABELS[status as keyof typeof SHIPMENT_STATUS_LABELS]}
                        </span>
                        {evt && (
                          <>
                            <span className="text-[12px] text-ink-3">
                              {formatDateTime(evt.createdAt)}
                              {evt.location && ` · ${evt.location}`}
                            </span>
                            {evt.note && (
                              <span className="font-mono text-[11px] text-ink-4">
                                {evt.note}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-full border-line-2 h-11 justify-center"
            >
              <MessageCircle className="h-4 w-4 mr-2 text-[#25D366]" />
              Activer notifs WhatsApp
            </Button>
          </aside>
        </div>

        {/* Rangée du bas : détails + paiement */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-2xl border border-line bg-surface p-5 md:p-6 min-w-0">
            <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>DÉTAILS DU COLIS</span>
            <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Mode" value={TRANSPORT_MODE_LABELS[shipment.mode]} />
              <Row label="Catégorie" value={CARGO_CATEGORY_LABELS[shipment.category]} />
              <Row label="Pièces" value={String(shipment.pieces)} />
              {shipment.weightKg && <Row label="Poids réel" value={`${shipment.weightKg} kg`} />}
              {shipment.volumetricWeight && <Row label="Poids volumique" value={`${shipment.volumetricWeight.toFixed(2)} kg`} />}
              {shipment.chargeableWeight && <Row label="Poids facturable" value={`${shipment.chargeableWeight.toFixed(2)} kg`} />}
              {shipment.volumeCBM && <Row label="Volume" value={`${shipment.volumeCBM.toFixed(3)} m³`} />}
              {shipment.destinationCity && (
                <Row
                  label="Destination"
                  value={`${shipment.destinationCity}, ${shipment.destinationCountry ?? ""}`}
                />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 md:p-6 min-w-0">
            <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>PAIEMENT</span>
            <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Total" value={formatXOF(shipment.totalAmount)} />
              <Row label="Acompte (50%)" value={formatXOF(shipment.depositAmount)} />
              <Row
                label="Solde restant"
                value={formatXOF(
                  shipment.remainingAmount -
                    (shipment.amountPaid - shipment.depositAmount > 0
                      ? shipment.amountPaid - shipment.depositAmount
                      : 0),
                )}
              />
              <Row label="Statut" value={paymentLabel(shipment.paymentStatus)} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="text-[13px] font-semibold text-ink text-right">{value}</span>
    </div>
  );
}

function paymentLabel(s: string) {
  return {
    UNPAID: "Non payé",
    DEPOSIT_PAID: "Acompte 50% payé",
    FULLY_PAID: "Soldé",
    REFUNDED: "Remboursé",
  }[s] ?? s;
}
