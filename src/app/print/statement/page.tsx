import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatXOF, formatDate, formatDateTime } from "@/lib/utils";
import { TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { PrintActions } from "@/app/print/manifest/envoi/[id]/print-actions";

export default async function PrintStatementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const clientId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { name: true, email: true, phone: true, whatsapp: true, address: true, city: true, country: true },
  });
  if (!user) redirect("/login");

  const [factures, shipments] = await Promise.all([
    prisma.facture.findMany({
      where: { clientId },
      include: { shipments: { select: { trackingNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shipment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totals = shipments.reduce(
    (acc, s) => {
      acc.totalAmount += s.totalAmount;
      acc.amountPaid += s.amountPaid;
      acc.remaining += Math.max(0, s.totalAmount - s.amountPaid);
      return acc;
    },
    { totalAmount: 0, amountPaid: 0, remaining: 0 },
  );

  return (
    <div className="bg-white min-h-screen text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 1.2cm; }
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
            <h1 className="text-2xl font-bold">RELEVÉ DE COMPTE</h1>
            <p className="text-sm text-gray-600">AFRYNTIX — Transport &amp; Logistique</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            Édité le {new Date().toLocaleString("fr-FR")}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Client</div>
            <div className="font-medium">{user.name}</div>
            <div className="text-xs">{user.email}</div>
            {user.phone && <div className="text-xs">Tél : {user.phone}</div>}
            {user.whatsapp && <div className="text-xs">WhatsApp : {user.whatsapp}</div>}
            {(user.address || user.city) && (
              <div className="text-xs mt-1">
                {[user.address, user.city, user.country].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Synthèse</div>
            <div className="text-sm flex justify-between"><span>Total facturé</span><span className="font-medium">{formatXOF(totals.totalAmount)}</span></div>
            <div className="text-sm flex justify-between"><span>Total encaissé</span><span className="font-medium text-emerald-700">{formatXOF(totals.amountPaid)}</span></div>
            <div className="text-sm flex justify-between border-t pt-1 mt-1"><span className="font-medium">Solde restant</span><span className="font-bold">{formatXOF(totals.remaining)}</span></div>
          </div>
        </section>

        <h2 className="text-sm font-semibold mb-2">Factures ({factures.length})</h2>
        <table className="mb-6">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Date</th>
              <th>Colis</th>
              <th>Total</th>
              <th>Payé</th>
              <th>Solde</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {factures.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-500 py-2">Aucune facture</td></tr>
            ) : factures.map((f) => (
              <tr key={f.id}>
                <td className="font-mono">{f.reference}</td>
                <td>{formatDate(f.createdAt)}</td>
                <td>{f.shipments.length}</td>
                <td className="text-right">{formatXOF(f.totalAmount)}</td>
                <td className="text-right">{formatXOF(f.amountPaid)}</td>
                <td className="text-right">{formatXOF(f.remainingAmount)}</td>
                <td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-sm font-semibold mb-2">Colis ({shipments.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Tracking</th>
              <th>Date</th>
              <th>Mode</th>
              <th>Destination</th>
              <th>Total</th>
              <th>Solde</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-500 py-2">Aucun colis</td></tr>
            ) : shipments.map((s) => (
              <tr key={s.id}>
                <td className="font-mono">{s.trackingNumber}</td>
                <td>{formatDateTime(s.createdAt)}</td>
                <td>{TRANSPORT_MODE_LABELS[s.mode]}</td>
                <td>{[s.destinationCity, s.destinationCountry].filter(Boolean).join(", ") || "—"}</td>
                <td className="text-right">{formatXOF(s.totalAmount)}</td>
                <td className="text-right">{formatXOF(Math.max(0, s.totalAmount - s.amountPaid))}</td>
                <td>{SHIPMENT_STATUS_LABELS[s.status]}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>TOTAL</td>
              <td className="text-right">{formatXOF(totals.totalAmount)}</td>
              <td className="text-right">{formatXOF(totals.remaining)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-8 text-xs text-gray-500">
          AFRYNTIX — Transport &amp; Logistique Chine → Afrique de l&apos;Ouest. Ce relevé est généré automatiquement.
        </footer>
      </div>
    </div>
  );
}
