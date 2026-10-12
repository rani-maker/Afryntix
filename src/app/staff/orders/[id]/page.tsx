import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATALOG_ORDER_STATUS_LABELS, CATALOG_ORDER_STATUS_TONE } from "@/lib/catalog-labels";
import { formatDateTime } from "@/lib/utils";
import { OrderEditor } from "./order-editor";
import { Button } from "@/components/ui/button";
import { ShipmentStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { orderParty } from "@/lib/catalog-orders";
import { shopOrderItemImage } from "@/lib/shop-products";
import { buildCatalogOrderWhatsAppUrl, getCatalogOrderPublicUrl } from "@/lib/catalog-order-link";
import { CopyLinkButton } from "@/components/catalogues/copy-link-button";

export default async function StaffCatalogOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true, phone: true, whatsapp: true } },
      handledBy: { select: { name: true } },
      items: true,
      shipments: {
        select: { id: true, trackingNumber: true, status: true, mode: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  const party = orderParty(order);
  const quoted = order.quotedAt != null && order.totalAmount != null && order.status !== "PENDING";
  // Lien signé : le client y suit sa demande et y valide son devis, même sans compte
  const publicUrl = getCatalogOrderPublicUrl(order.id);
  const whatsappUrl = publicUrl
    ? buildCatalogOrderWhatsAppUrl({
        phone: party.phone,
        name: party.name,
        reference: order.reference,
        totalAmount: quoted ? order.totalAmount : null,
        publicUrl,
      })
    : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/staff/orders" className="text-sm text-muted-foreground hover:text-primary">
        ← Commandes catalogue
      </Link>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="font-mono">{order.reference}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1.5">
              Reçue le {formatDateTime(order.createdAt)}
              {order.handledBy ? ` · Suivie par ${order.handledBy.name}` : ""}
            </p>
          </div>
          <Badge variant={CATALOG_ORDER_STATUS_TONE[order.status]}>{CATALOG_ORDER_STATUS_LABELS[order.status]}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Client</dt>
              <dd className="font-medium">
                {party.name}
                {party.guest && (
                  <Badge variant="secondary" className="ml-2 align-middle">
                    Sans compte
                  </Badge>
                )}
              </dd>
              <dd className="text-xs text-muted-foreground">{party.email ?? "Pas d'email"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Contact</dt>
              <dd>{party.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ville de livraison</dt>
              <dd>{order.deliveryCity ?? "—"}</dd>
            </div>
          </dl>
          {order.notes && (
            <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">
              <span className="font-medium">Message du client : </span>
              {order.notes}
            </p>
          )}
          {publicUrl && (
            <section className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <h3 className="text-sm font-semibold">Lien du client</h3>
                <p className="text-xs text-muted-foreground">
                  {party.guest
                    ? "Demande sans compte : le client suit sa demande et valide son devis uniquement par ce lien. Envoyez-le-lui par WhatsApp après avoir envoyé le devis."
                    : "Le client retrouve sa commande dans son espace. Ce lien lui permet aussi de la consulter et de valider son devis sans se connecter."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {whatsappUrl && (
                  <Button asChild size="sm">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      Envoyer par WhatsApp
                    </a>
                  </Button>
                )}
                <CopyLinkButton url={publicUrl} />
              </div>
            </section>
          )}
          <OrderEditor
            order={{
              id: order.id,
              status: order.status,
              staffNotes: order.staffNotes ?? "",
              feesAmount: order.feesAmount,
              totalAmount: order.totalAmount,
              quotedAt: order.quotedAt ? formatDateTime(order.quotedAt) : null,
              items: order.items.map((i) => ({
                id: i.id,
                catalogId: i.catalogId,
                catalogTitle: i.catalogTitle,
                category: i.category,
                reference: i.reference,
                designation: i.designation,
                page: i.page,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                lineTotal: i.lineTotal,
                note: i.note,
                posX: i.posX,
                posY: i.posY,
                productImage: shopOrderItemImage(i),
              })),
            }}
          />
          <section className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Expédition</h3>
                <p className="text-xs text-muted-foreground">
                  Créez le colis une fois le devis accepté : le client reçoit son numéro de suivi et la commande passe
                  en « Expédiée ».
                </p>
              </div>
              {["CONFIRMED", "IN_PREPARATION", "SHIPPED"].includes(order.status) ? (
                <Button asChild size="sm">
                  <Link href={`/staff/shipments/new?orderId=${order.id}`}>
                    {order.shipments.length > 0 ? "+ Ajouter un colis" : "Créer l'expédition"}
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {order.status === "PENDING" || order.status === "QUOTED"
                    ? "Disponible après acceptation du devis"
                    : null}
                </span>
              )}
            </div>
            {order.shipments.length > 0 && (
              <ul className="divide-y rounded-md border">
                {order.shipments.map((s) => (
                  <li key={s.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <Link href={`/staff/shipments/${s.id}`} className="font-mono text-primary hover:underline">
                        {s.trackingNumber}
                      </Link>
                      <span className="text-xs text-muted-foreground ml-2">
                        {TRANSPORT_MODE_LABELS[s.mode]} · {formatDateTime(s.createdAt)}
                      </span>
                    </div>
                    <ShipmentStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
