import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { CATALOG_CATEGORY_LABELS } from "@/lib/catalog-labels";
import { formatDate, formatXOF } from "@/lib/utils";
import { PrintActions } from "@/app/print/manifest/envoi/[id]/print-actions";

/**
 * Document A4 d'une commande catalogue : « Bon de commande » tant que le
 * devis n'est pas envoyé, « Devis » ensuite. Accès : staff/admin, ou le
 * client propriétaire (qui ne voit les prix qu'une fois le devis envoyé).
 */
export default async function PrintDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    include: {
      items: true,
      client: { select: { name: true, email: true, phone: true, whatsapp: true, address: true, city: true, country: true } },
    },
  });
  if (!order) notFound();

  const isTeam = session.user.role === "ADMIN" || session.user.role === "STAFF";
  if (!isTeam && order.clientId !== session.user.id) notFound();

  const quoted = order.quotedAt != null && order.totalAmount != null && order.status !== "PENDING";
  const subtotal = order.items.reduce((s, i) => s + (i.lineTotal ?? 0), 0);

  return (
    <div className="bg-white min-h-screen text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 1.2cm; }
        }
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-weight: 600; }
        tr.total td { font-weight: 700; background: #f9fafb; }
        .num { text-align: right; white-space: nowrap; }
      `}</style>

      <div className="p-8 max-w-[900px] mx-auto">
        <PrintActions />

        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{quoted ? "DEVIS" : "BON DE COMMANDE"}</h1>
            <p className="text-sm font-mono">{order.reference}</p>
            <p className="text-xs text-gray-500 mt-1">
              Commande du {formatDate(order.createdAt)}
              {quoted && order.quotedAt ? ` · Devis du ${formatDate(order.quotedAt)}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <div className="text-sm font-semibold text-black">{COMPANY.name}</div>
            <div>{COMPANY.tagline}</div>
            {COMPANY.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div>Tél : {COMPANY.phone}</div>
            <div>
              RCCM {COMPANY.rccm} · NCC {COMPANY.ncc}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Client</div>
            <div className="font-medium">{order.client.name}</div>
            <div className="text-xs">{order.client.email}</div>
            <div className="text-xs">
              Tél : {order.contactPhone ?? order.client.whatsapp ?? order.client.phone ?? "—"}
            </div>
            {(order.client.address || order.client.city) && (
              <div className="text-xs mt-1">
                {[order.client.address, order.client.city, order.client.country].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">Livraison</div>
            <div className="font-medium">{order.deliveryCity ?? "À préciser"}</div>
            {order.notes && <div className="text-xs mt-1">Message : {order.notes}</div>}
          </div>
        </section>

        <table className="mb-4">
          <thead>
            <tr>
              <th style={{ width: 28 }}>N°</th>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catalogue</th>
              <th className="num">Qté</th>
              {quoted && <th className="num">Prix unitaire</th>}
              {quoted && <th className="num">Total</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={i.id}>
                <td>{idx + 1}</td>
                <td className="font-mono">
                  {i.reference}
                  {i.page ? ` (p. ${i.page})` : ""}
                </td>
                <td>{i.designation}</td>
                <td>
                  {i.catalogTitle}
                  <div className="text-gray-500">{CATALOG_CATEGORY_LABELS[i.category]}</div>
                </td>
                <td className="num">{i.quantity}</td>
                {quoted && <td className="num">{i.unitPrice != null ? formatXOF(i.unitPrice) : "—"}</td>}
                {quoted && <td className="num">{i.lineTotal != null ? formatXOF(i.lineTotal) : "—"}</td>}
              </tr>
            ))}
            {quoted && (
              <>
                <tr>
                  <td colSpan={6} className="num">
                    Sous-total articles
                  </td>
                  <td className="num">{formatXOF(subtotal)}</td>
                </tr>
                {!!order.feesAmount && (
                  <tr>
                    <td colSpan={6} className="num">
                      Frais annexes (transport, emballage…)
                    </td>
                    <td className="num">{formatXOF(order.feesAmount)}</td>
                  </tr>
                )}
                <tr className="total">
                  <td colSpan={6} className="num">
                    TOTAL DU DEVIS
                  </td>
                  <td className="num">{formatXOF(order.totalAmount ?? 0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {quoted && order.staffNotes && (
          <p className="text-xs border rounded p-3 mb-4">
            <span className="font-semibold">Remarque : </span>
            {order.staffNotes}
          </p>
        )}

        {!quoted && (
          <p className="text-xs text-gray-600 mb-4">
            Bon de commande sans prix : le devis est établi par {COMPANY.name} après réception.
          </p>
        )}

        <footer className="mt-8 text-xs text-gray-500">
          {COMPANY.name} — {COMPANY.website}. Document généré automatiquement.
        </footer>
      </div>
    </div>
  );
}
