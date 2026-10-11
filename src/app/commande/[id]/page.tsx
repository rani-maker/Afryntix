import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/public-header";
import { CATALOG_ORDER_STATUS_LABELS, CATALOG_ORDER_STATUS_TONE } from "@/lib/catalog-labels";
import { buildCompanyWhatsAppUrl, verifyCatalogOrderSignature } from "@/lib/catalog-order-link";
import { orderParty } from "@/lib/catalog-orders";
import { COMPANY } from "@/lib/company";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { OrderLinkActions } from "./order-link-actions";

// Suivi d'une demande de devis sans compte, via le lien signé remis au demandeur
// (écran de confirmation du panier, WhatsApp ou email). Le devis s'y consulte et s'y valide.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> };

export const metadata: Metadata = {
  title: { absolute: "Votre demande de devis | AFRYNTIX" },
  robots: { index: false, follow: false },
};

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: "Demande reçue. Notre équipe prépare votre devis : il apparaîtra sur cette page.",
  QUOTED: "Votre devis est prêt. Vérifiez-le puis acceptez-le pour lancer la commande.",
  CONFIRMED: "Devis accepté. Nous lançons votre commande auprès du fournisseur.",
  IN_PREPARATION: "Votre commande est en préparation chez le fournisseur.",
  SHIPPED: "Votre commande est expédiée. Suivez votre colis ci-dessous.",
  DELIVERED: "Votre commande a été livrée. Merci de votre confiance.",
  CANCELLED: "Cette demande a été annulée.",
};

export default async function OrderLinkPage({ params, searchParams }: Props) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!k || !verifyCatalogOrderSignature(id, k)) notFound();

  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    include: {
      items: true,
      client: { select: { name: true } },
      shipments: { select: { id: true, trackingNumber: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  // Le devis n'est visible qu'une fois envoyé par AFRYNTIX
  const quoted = order.quotedAt != null && order.totalAmount != null && order.status !== "PENDING";
  const party = orderParty(order);
  const whatsappUrl = buildCompanyWhatsAppUrl(order.reference);

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/catalogue" />
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-16 pt-8 sm:px-6">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-mint-3">Demande de devis</div>
              <h1 className="afx-num mt-1 text-xl text-ink">{order.reference}</h1>
              <p className="mt-1 text-xs text-ink-3">
                {party.name} · {formatDateTime(order.createdAt)}
                {order.deliveryCity ? ` · Livraison : ${order.deliveryCity}` : ""}
              </p>
            </div>
            <Badge variant={CATALOG_ORDER_STATUS_TONE[order.status]}>{CATALOG_ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>
          <p className="mt-4 text-sm text-ink-2">{STATUS_MESSAGES[order.status]}</p>
          {quoted && (
            <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <span className="text-sm text-ink-2">Total du devis</span>
              <span className="afx-num text-2xl text-ink">{formatXOF(order.totalAmount ?? 0)}</span>
            </div>
          )}
          {(order.status === "PENDING" || order.status === "QUOTED") && (
            <div className="mt-4">
              <OrderLinkActions id={order.id} signature={k} reference={order.reference} quoted={order.status === "QUOTED"} />
            </div>
          )}
        </section>

        {order.shipments.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Suivi de l&apos;expédition</h2>
            <ul className="mt-2 space-y-2">
              {order.shipments.map((s) => (
                <li key={s.id}>
                  <Link href={`/tracking/${s.trackingNumber}`} className="afx-num text-mint-3 hover:underline">
                    {s.trackingNumber}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface">
          <h2 className="px-5 pt-5 text-sm font-semibold text-ink">
            {order.items.length} article{order.items.length > 1 ? "s" : ""}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 px-5 py-3">
                {i.posX != null && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/catalogue/order-item/${i.id}/image?k=${k}`}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-ink">{i.designation}</div>
                  <div className="text-xs text-ink-3">
                    {i.reference ? `Réf. ${i.reference} · ` : ""}
                    {i.catalogTitle}
                    {i.page ? ` · p. ${i.page}` : ""}
                  </div>
                  {i.note && <div className="mt-0.5 text-xs text-ink-2">« {i.note} »</div>}
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-ink-2">
                      Quantité : <span className="afx-num text-ink">{i.quantity}</span>
                      {quoted && i.unitPrice != null ? ` × ${formatXOF(i.unitPrice)}` : ""}
                    </span>
                    {quoted && i.lineTotal != null && <span className="afx-num text-ink">{formatXOF(i.lineTotal)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {quoted && (
            <dl className="space-y-1 border-t border-line px-5 py-4 text-sm">
              {!!order.feesAmount && (
                <div className="flex justify-between gap-3 text-ink-2">
                  <dt>Frais annexes (transport, emballage…)</dt>
                  <dd className="afx-num">{formatXOF(order.feesAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 font-semibold text-ink">
                <dt>Total du devis</dt>
                <dd className="afx-num">{formatXOF(order.totalAmount ?? 0)}</dd>
              </div>
            </dl>
          )}
        </section>

        {quoted && order.staffNotes && (
          <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-2">
            <span className="font-semibold text-ink">AFRYNTIX : </span>
            {order.staffNotes}
          </p>
        )}
        {order.notes && (
          <p className="px-1 text-sm text-ink-3">
            <span className="font-medium text-ink-2">Votre message : </span>
            {order.notes}
          </p>
        )}

        <section className="flex flex-col items-center gap-2 pt-2 text-center text-sm text-ink-3">
          <p>Une question sur votre demande ? {COMPANY.phone}</p>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full border border-line-2 bg-surface px-5 font-medium text-ink hover:border-mint-3"
            >
              Nous écrire sur WhatsApp
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
