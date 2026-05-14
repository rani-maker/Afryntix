import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  TRANSPORT_MODE_LABELS,
  CARRIER_LABELS,
  CARGO_CATEGORY_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/pricing";
import { formatDate, formatXOF } from "@/lib/utils";
import { PrintActions } from "./print-actions";

export default async function PrintManifestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ containerId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STAFF" && session.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const { containerId } = await searchParams;

  const envoi = await prisma.envoi.findUnique({
    where: { id },
    include: {
      shipments: {
        where: containerId ? { containerId } : undefined,
        include: {
          client: { select: { name: true } },
          shippingMark: { select: { name: true, phone: true } },
        },
        orderBy: [{ shippingMarkId: "asc" }, { trackingNumber: "asc" }],
      },
    },
  });
  if (!envoi) notFound();

  const container = containerId
    ? await prisma.container.findUnique({ where: { id: containerId } })
    : null;

  const totals = envoi.shipments.reduce(
    (acc, s) => {
      acc.pieces += s.pieces;
      acc.weight += s.weightKg ?? 0;
      acc.chargeable += s.chargeableWeight ?? 0;
      acc.cbm += s.volumeCBM ?? 0;
      acc.amount += s.totalAmount;
      return acc;
    },
    { pieces: 0, weight: 0, chargeable: 0, cbm: 0, amount: 0 },
  );

  return (
    <div className="bg-white min-h-screen text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 1cm; }
        }
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        tr.total td { font-weight: 700; background: #f9fafb; }
      `}</style>
      <div className="p-8 max-w-[1400px] mx-auto">
        <PrintActions />

        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">MANIFESTE</h1>
            <p className="text-sm text-gray-600">AFRYNTIX — Transport &amp; Logistique</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-semibold">{envoi.reference}</div>
            <div className="text-xs text-gray-500">Édité le {new Date().toLocaleString("fr-FR")}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Itinéraire</div>
            <div className="font-medium">{envoi.origin} → {envoi.destination}</div>
            <div className="text-xs">{TRANSPORT_MODE_LABELS[envoi.mode]}</div>
            {envoi.departureDate && <div className="text-xs">Départ : {formatDate(envoi.departureDate)}</div>}
            {envoi.arrivalDate && <div className="text-xs">Arrivée prévue : {formatDate(envoi.arrivalDate)}</div>}
          </div>
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Carrier</div>
            <div className="font-medium">{envoi.carrier ? CARRIER_LABELS[envoi.carrier] : "—"}</div>
            {envoi.bookingNumber && <div className="text-xs">Booking : {envoi.bookingNumber}</div>}
            {envoi.vesselName && <div className="text-xs">Navire : {envoi.vesselName} / Voyage {envoi.voyageNumber}</div>}
            {envoi.mawb && <div className="text-xs">MAWB : {envoi.mawb} / Vol {envoi.flightNumber}</div>}
            {container && <div className="text-xs">Container : {container.refInternal}{container.carrierNumber ? ` (${container.carrierNumber})` : ""}</div>}
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tracking</th>
              <th>Shipping Mark</th>
              <th>Client</th>
              <th>Cat.</th>
              <th>Description</th>
              <th>Pcs</th>
              <th>Poids (kg)</th>
              <th>Taxable</th>
              <th>CBM</th>
              <th>Destination</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {envoi.shipments.map((s, idx) => (
              <tr key={s.id}>
                <td>{idx + 1}</td>
                <td className="font-mono">{s.trackingNumber}</td>
                <td>{s.shippingMark ? `${s.shippingMark.name} · ${s.shippingMark.phone}` : "—"}</td>
                <td>{s.client?.name ?? s.clientName ?? "—"}</td>
                <td>{CARGO_CATEGORY_LABELS[s.category]}</td>
                <td>{s.description ?? "—"}</td>
                <td className="text-right">{s.pieces}</td>
                <td className="text-right">{s.weightKg ?? "—"}</td>
                <td className="text-right">{s.chargeableWeight != null ? s.chargeableWeight.toFixed(2) : "—"}</td>
                <td className="text-right">{s.volumeCBM != null ? s.volumeCBM.toFixed(3) : "—"}</td>
                <td>{[s.destinationCity, s.destinationCountry].filter(Boolean).join(", ") || "—"}</td>
                <td className="text-right">{formatXOF(s.totalAmount)}</td>
                <td>{SHIPMENT_STATUS_LABELS[s.status]}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={6}>TOTAL ({envoi.shipments.length} colis)</td>
              <td className="text-right">{totals.pieces}</td>
              <td className="text-right">{totals.weight.toFixed(2)}</td>
              <td className="text-right">{totals.chargeable.toFixed(2)}</td>
              <td className="text-right">{totals.cbm.toFixed(3)}</td>
              <td></td>
              <td className="text-right">{formatXOF(totals.amount)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-8 text-xs text-gray-500 grid grid-cols-3 gap-4">
          <div>
            <div className="font-semibold mb-1">Pour le transitaire</div>
            <div className="h-12 border-b"></div>
            <div className="mt-1">Signature et cachet</div>
          </div>
          <div>
            <div className="font-semibold mb-1">Pour le transporteur</div>
            <div className="h-12 border-b"></div>
            <div className="mt-1">Signature et cachet</div>
          </div>
          <div>
            <div className="font-semibold mb-1">Réception destination</div>
            <div className="h-12 border-b"></div>
            <div className="mt-1">Signature et cachet</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
