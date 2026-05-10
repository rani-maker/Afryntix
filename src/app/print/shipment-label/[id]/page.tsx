import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDate, getAppUrl } from "@/lib/utils";
import { LabelToolbar } from "./toolbar";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Étiquette d'expédition" };

export default async function ShipmentLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STAFF" && session.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { client: { select: { name: true, phone: true } } },
  });
  if (!shipment) notFound();

  const trackingUrl = `${getAppUrl()}/tracking/${shipment.trackingNumber}`;

  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });

  const senderName = shipment.client?.name ?? shipment.clientName ?? "Client";
  const senderPhone = shipment.client?.phone ?? shipment.clientPhone ?? "";

  return (
    <div className="label-page">
      <LabelToolbar />

      <div className="label">
        {/* Header band */}
        <div className="label-header">
          <div className="brand">
            <Logo variant="sm" tone="dark" className="brand-logo" />
            <div className="brand-tag">Chine → Afrique de l&apos;Ouest</div>
          </div>
          <div className="service">{TRANSPORT_MODE_LABELS[shipment.mode]}</div>
        </div>

        {/* Body */}
        <div className="label-body">
          <div className="row two-col">
            <div className="col">
              <div className="lbl">EXPÉDITEUR</div>
              <div className="val">{senderName}</div>
              {senderPhone && <div className="sub">{senderPhone}</div>}
              <div className="sub">Guangzhou, Chine</div>
            </div>
            <div className="col">
              <div className="lbl">DESTINATAIRE</div>
              <div className="val">{shipment.recipientName ?? "—"}</div>
              {shipment.recipientPhone && <div className="sub">{shipment.recipientPhone}</div>}
              {shipment.recipientAddress && <div className="sub">{shipment.recipientAddress}</div>}
              <div className="sub strong">
                {[shipment.destinationCity, shipment.destinationCountry].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>

          <div className="row meta">
            <div>
              <span className="lbl">CATÉGORIE</span>
              <span className="val-inline">{CARGO_CATEGORY_LABELS[shipment.category]}</span>
            </div>
            <div>
              <span className="lbl">PIÈCES</span>
              <span className="val-inline">{shipment.pieces}</span>
            </div>
            <div>
              <span className="lbl">POIDS</span>
              <span className="val-inline">
                {shipment.chargeableWeight
                  ? `${shipment.chargeableWeight.toFixed(2)} kg`
                  : shipment.weightKg
                  ? `${shipment.weightKg} kg`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="lbl">VOLUME</span>
              <span className="val-inline">
                {shipment.volumeCBM ? `${shipment.volumeCBM.toFixed(3)} m³` : "—"}
              </span>
            </div>
          </div>

          {/* Tracking + QR */}
          <div className="tracking-block">
            <div className="tracking-text">
              <div className="lbl">N° DE SUIVI</div>
              <div className="tracking-num">{shipment.trackingNumber}</div>
              <div className="sub">Scannez le QR pour suivre le colis en ligne.</div>
              <div className="sub mono small">{trackingUrl}</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR de suivi" className="qr" />
          </div>
        </div>

        <div className="label-footer">
          <div>Créé le {formatDate(shipment.createdAt)}</div>
          <div>afryntix.com</div>
        </div>
      </div>

      <style>{`
        @page { size: 100mm 150mm; margin: 0; }
        html, body { background: #f5f5f5; }
        .label-page { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.25rem 0.75rem; }
        .label {
          width: 100mm;
          height: 150mm;
          background: #fff;
          color: #000;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
          border: 1px solid #000;
        }
        .label-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 3mm 4mm;
          background: #000; color: #fff;
        }
        .brand-logo { height: 8mm; width: auto; display: block; }
        .brand-tag { font-size: 7pt; opacity: 0.8; margin-top: 1mm; }
        .service { font-size: 9pt; font-weight: 700; text-transform: uppercase; border: 1px solid #fff; padding: 1mm 2mm; border-radius: 1mm; }
        .label-body { flex: 1; padding: 4mm; display: flex; flex-direction: column; gap: 3mm; }
        .row { display: flex; }
        .two-col { gap: 3mm; }
        .col { flex: 1; min-width: 0; border: 1px solid #000; padding: 2mm; }
        .lbl { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.5pt; color: #555; text-transform: uppercase; }
        .val { font-size: 11pt; font-weight: 700; line-height: 1.15; margin-top: 0.5mm; word-break: break-word; }
        .sub { font-size: 8pt; line-height: 1.25; word-break: break-word; }
        .sub.strong { font-weight: 700; margin-top: 1mm; }
        .meta { gap: 0; border: 1px solid #000; }
        .meta > div { flex: 1; padding: 1.5mm 2mm; border-right: 1px solid #000; min-width: 0; }
        .meta > div:last-child { border-right: 0; }
        .meta .lbl { display: block; }
        .val-inline { display: block; font-weight: 700; font-size: 9pt; margin-top: 0.5mm; }
        .tracking-block { display: flex; gap: 3mm; align-items: center; border: 2px solid #000; padding: 2.5mm; margin-top: auto; }
        .tracking-text { flex: 1; min-width: 0; }
        .tracking-num { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13pt; font-weight: 800; letter-spacing: 0.5pt; line-height: 1.1; margin: 0.5mm 0 1mm; }
        .mono { font-family: ui-monospace, monospace; }
        .small { font-size: 7pt; word-break: break-all; }
        .qr { width: 28mm; height: 28mm; }
        .label-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.5mm 4mm; background: #000; color: #fff; font-size: 7pt;
        }
        @media print {
          html, body { background: #fff; }
          .label-page { padding: 0; gap: 0; }
          .label { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
