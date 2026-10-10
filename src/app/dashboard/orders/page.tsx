import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderLinesTable } from "@/components/catalogues/order-lines-table";
import { CATALOG_ORDER_STATUS_LABELS, CATALOG_ORDER_STATUS_TONE } from "@/lib/catalog-labels";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { OrderClientActions } from "./order-client-actions";

export default async function ClientOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orders = await prisma.catalogOrder.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mes commandes</h2>
          <p className="text-sm text-muted-foreground">
            Vos bons de commande Sanitaire, Déco &amp; Luminaire et Meuble, et les devis envoyés par AFRYNTIX.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button asChild variant="outline">
            <Link href="/dashboard/catalogue">Catalogues</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/catalogue/order">+ Nouvelle commande</Link>
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Aucune commande. Consultez un catalogue puis cliquez sur « Commander ».
        </div>
      ) : (
        orders.map((o) => {
          // Le devis n'est visible qu'une fois envoyé par AFRYNTIX
          const quoted = o.quotedAt != null && o.totalAmount != null && o.status !== "PENDING";
          return (
            <Card key={o.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="font-mono text-base">{o.reference}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {formatDateTime(o.createdAt)}
                    {o.deliveryCity ? ` · Livraison : ${o.deliveryCity}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={CATALOG_ORDER_STATUS_TONE[o.status]}>{CATALOG_ORDER_STATUS_LABELS[o.status]}</Badge>
                  {quoted && (
                    <div className="text-lg font-semibold tabular-nums mt-1">{formatXOF(o.totalAmount ?? 0)}</div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <OrderLinesTable
                  items={o.items}
                  showPrices={quoted}
                  feesAmount={o.feesAmount}
                  totalAmount={o.totalAmount}
                />
                {o.status === "PENDING" && (
                  <p className="text-sm text-muted-foreground">
                    Bon de commande reçu. Notre équipe prépare votre devis : vous serez notifié dès qu&apos;il est prêt.
                  </p>
                )}
                {o.notes && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Votre message : </span>
                    {o.notes}
                  </p>
                )}
                {quoted && o.staffNotes && (
                  <p className="text-sm rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                    <span className="font-medium">AFRYNTIX : </span>
                    {o.staffNotes}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/print/devis/${o.id}`}>{quoted ? "Imprimer le devis" : "Imprimer le bon de commande"}</Link>
                  </Button>
                  {(o.status === "PENDING" || o.status === "QUOTED") && (
                    <OrderClientActions id={o.id} reference={o.reference} quoted={o.status === "QUOTED"} />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
