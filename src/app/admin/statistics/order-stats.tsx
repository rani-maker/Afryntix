import Link from "next/link";
import { Banknote, Clock, FileText, Hourglass, Percent, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATALOG_CATEGORY_LABELS, CATALOG_ORDER_STATUS_LABELS } from "@/lib/catalog-labels";
import { getCatalogOrderStats } from "@/lib/catalog-order-stats";
import { formatXOF } from "@/lib/utils";
import { OrderCharts } from "./order-charts";

function formatDelay(hours: number | null) {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1).replace(".", ",")} j`;
}

export async function OrderStatistics() {
  const s = await getCatalogOrderStats();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Commandes catalogue</h2>
          <p className="text-sm text-muted-foreground">
            Bons de commande reçus depuis les catalogues, devis envoyés et commandes validées.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/orders">Voir les commandes</Link>
        </Button>
      </div>

      {/* 2 colonnes jusqu'aux grands écrans : les montants en FCFA ont besoin de largeur */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Commandes reçues"
          value={s.total}
          hint={`dont ${s.guests} sans compte`}
          icon={<ShoppingBag />}
          href="/admin/orders"
        />
        <StatsCard
          label="En cours"
          value={s.inProgress}
          hint="Ni livrées ni annulées"
          tone="info"
          icon={<Truck />}
          href="/admin/orders"
        />
        <StatsCard
          label="Devis à établir"
          value={s.toQuote}
          tone="warning"
          icon={<FileText />}
          href="/admin/orders?status=PENDING"
        />
        <StatsCard
          label="Devis en attente de réponse"
          value={s.awaitingAnswer}
          tone="warning"
          icon={<Hourglass />}
          href="/admin/orders?status=QUOTED"
        />
        <StatsCard
          label="Montant des devis acceptés"
          value={formatXOF(s.validatedAmount)}
          hint={`${s.validatedCount} commande${s.validatedCount > 1 ? "s" : ""} validée${s.validatedCount > 1 ? "s" : ""}`}
          tone="success"
          icon={<Banknote />}
        />
        <StatsCard
          label="Panier moyen"
          value={s.averageBasket != null ? formatXOF(s.averageBasket) : "—"}
          hint="Par commande validée"
          icon={<ShoppingCart />}
        />
        <StatsCard
          label="Taux d'acceptation"
          value={s.acceptanceRate != null ? `${s.acceptanceRate.toFixed(0)} %` : "—"}
          hint={`${s.quotesAccepted} sur ${s.quotesSent} devis envoyé${s.quotesSent > 1 ? "s" : ""}`}
          tone="success"
          icon={<Percent />}
        />
        <StatsCard
          label="Délai moyen du devis"
          value={formatDelay(s.avgQuoteHours)}
          hint="De la demande à l'envoi du devis"
          icon={<Clock />}
        />
      </div>

      <OrderCharts
        monthly={s.monthly.map(({ month, received, validated }) => ({ month, received, validated }))}
        byStatus={s.byStatus.map((g) => ({
          // Vu de l'équipe, une commande « en préparation de devis » est un devis à établir
          name: g.status === "PENDING" ? "Devis à établir" : CATALOG_ORDER_STATUS_LABELS[g.status],
          value: g.count,
        }))}
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Récapitulatif mensuel</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Selon le mois de réception de la commande</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Reçues</TableHead>
                <TableHead className="text-right">Validées</TableHead>
                <TableHead className="text-right">Montant validé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.monthly.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="capitalize">{m.month}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.received}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.validated}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatXOF(m.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Par catégorie</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Commandes non annulées</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.byCategory.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell>{CATALOG_CATEGORY_LABELS[c.category]}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.lines}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Catalogues les plus demandés</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Commandes non annulées</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catalogue</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.topCatalogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      Aucune commande pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  s.topCatalogs.map((c) => (
                    <TableRow key={c.title}>
                      <TableCell>{c.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.lines}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
