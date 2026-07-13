import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  TRANSPORT_MODE_LABELS,
  CARRIER_LABELS,
  CARGO_CATEGORY_LABELS,
} from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import { PrintActions } from "./print-actions";

export default async function PrintPackingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; markId: string }>;
  searchParams: Promise<{ containerId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, markId } = await params;
  const { containerId } = await searchParams;

  const envoi = await prisma.envoi.findUnique({
    where: { id },
    include: {
      shipments: {
        where: {
          shippingMarkId: markId,
          ...(containerId ? { containerId } : {}),
        },
        orderBy: { trackingNumber: "asc" },
      },
    },
  });
  if (!envoi) notFound();

  const mark = await prisma.shippingMark.findUnique({
    where: { id: markId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!mark) notFound();

  // Autorisation : STAFF/ADMIN, ou client propriétaire du shipping mark
  const isStaff = session.user.role === "STAFF" || session.user.role === "ADMIN";
  const isOwner = mark.user?.id && session.user.id === mark.user.id;
  if (!isStaff && !isOwner) redirect("/dashboard");

  if (envoi.shipments.length === 0) notFound();

  const container = containerId
    ? await prisma.container.findUnique({ where: { id: containerId } })
    : null;

  const totals = envoi.shipments.reduce(
    (acc, s) => {
      acc.pieces += s.pieces;
      acc.weight += s.weightKg ?? 0;
      acc.cbm += s.volumeCBM ?? 0;
      acc.customsValue += s.declaredCustomsValue ?? 0;
      return acc;
    },
    { pieces: 0, weight: 0, cbm: 0, customsValue: 0 },
  );

  const first = envoi.shipments[0];
  const destinationLabel = [first.destinationCity, first.destinationCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-white min-h-screen text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 1.2cm; }
        }
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        tr.total td { font-weight: 700; background: #f9fafb; }
      `}</style>
      <div className="p-8 max-w-[900px] mx-auto">
        <PrintActions />

        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">PACKING LIST</h1>
            <p className="text-sm text-gray-600">AFRYNTIX — Transport &amp; Logistique</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-semibold">{envoi.reference}</div>
            <div className="text-xs text-gray-500">
              Édité le {new Date().toLocaleString("fr-FR")}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Shipping mark</div>
            <div className="font-medium text-base">{mark.name}</div>
            {first.recipientName && (
              <div className="text-xs">Destinataire : {first.recipientName}</div>
            )}
            {destinationLabel && (
              <div className="text-xs">Destination : {destinationLabel}</div>
            )}
          </div>
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Envoi</div>
            <div className="text-xs">{TRANSPORT_MODE_LABELS[envoi.mode]}</div>
            <div className="text-xs">
              {envoi.origin} → {envoi.destination}
            </div>
            {envoi.carrier && (
              <div className="text-xs">Carrier : {CARRIER_LABELS[envoi.carrier]}</div>
            )}
            {envoi.vesselName && (
              <div className="text-xs">
                Navire : {envoi.vesselName} / Voyage {envoi.voyageNumber}
              </div>
            )}
            {envoi.mawb && (
              <div className="text-xs">
                MAWB : {envoi.mawb} / Vol {envoi.flightNumber}
              </div>
            )}
            {container && (
              <div className="text-xs">
                Container : {container.refInternal}
                {container.carrierNumber ? ` (${container.carrierNumber})` : ""}
              </div>
            )}
            {envoi.departureDate && (
              <div className="text-xs">Départ : {formatDate(envoi.departureDate)}</div>
            )}
            {envoi.arrivalDate && (
              <div className="text-xs">Arrivée prévue : {formatDate(envoi.arrivalDate)}</div>
            )}
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tracking</th>
              <th>Cat.</th>
              <th>Description</th>
              <th className="text-right">Pcs</th>
              <th className="text-right">Poids (kg)</th>
              <th className="text-right">L × l × H (cm)</th>
              <th className="text-right">CBM</th>
              <th>SH</th>
              <th>Incoterm</th>
              <th>Origine</th>
              <th className="text-right">Valeur douane</th>
            </tr>
          </thead>
          <tbody>
            {envoi.shipments.map((s, idx) => {
              const dims =
                s.lengthCm && s.widthCm && s.heightCm
                  ? `${s.lengthCm} × ${s.widthCm} × ${s.heightCm}`
                  : "—";
              return (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td className="font-mono">{s.trackingNumber}</td>
                  <td>{CARGO_CATEGORY_LABELS[s.category]}</td>
                  <td>{s.description ?? "—"}</td>
                  <td className="text-right">{s.pieces}</td>
                  <td className="text-right">{s.weightKg ?? "—"}</td>
                  <td className="text-right">{dims}</td>
                  <td className="text-right">
                    {s.volumeCBM != null ? s.volumeCBM.toFixed(3) : "—"}
                  </td>
                  <td>{s.hsCode ?? "—"}</td>
                  <td>{s.incoterm ?? "—"}</td>
                  <td>{s.countryOfOrigin ?? "—"}</td>
                  <td className="text-right">
                    {s.declaredCustomsValue != null
                      ? `${s.declaredCustomsValue.toLocaleString("fr-FR")}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={4}>TOTAL ({envoi.shipments.length} colis)</td>
              <td className="text-right">{totals.pieces}</td>
              <td className="text-right">{totals.weight.toFixed(2)}</td>
              <td></td>
              <td className="text-right">{totals.cbm.toFixed(3)}</td>
              <td colSpan={3}></td>
              <td className="text-right">
                {totals.customsValue > 0
                  ? totals.customsValue.toLocaleString("fr-FR")
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-8 text-xs text-gray-500 grid grid-cols-2 gap-4">
          <div>
            <div className="font-semibold mb-1">Expéditeur (AFRYNTIX)</div>
            <div className="h-12 border-b"></div>
            <div className="mt-1">Signature et cachet</div>
          </div>
          <div>
            <div className="font-semibold mb-1">Réception destinataire</div>
            <div className="h-12 border-b"></div>
            <div className="mt-1">Signature et cachet</div>
          </div>
        </footer>

        <p className="text-[10px] text-gray-400 mt-6">
          Document informatif — les valeurs douanières sont déclarées par l&apos;expéditeur.
        </p>
      </div>
    </div>
  );
}
