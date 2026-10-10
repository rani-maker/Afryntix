import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CATALOG_ORDER_STATUSES,
  CATALOG_ORDER_STATUS_LABELS,
  CATALOG_ORDER_STATUS_TONE,
  type CatalogOrderStatusKey,
} from "@/lib/catalog-labels";
import { formatDateTime, formatXOF } from "@/lib/utils";

export default async function StaffCatalogOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = CATALOG_ORDER_STATUSES.includes(rawStatus as CatalogOrderStatusKey)
    ? (rawStatus as CatalogOrderStatusKey)
    : undefined;

  const [orders, counts] = await Promise.all([
    prisma.catalogOrder.findMany({
      where: status ? { status } : undefined,
      include: {
        client: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.catalogOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Commandes catalogue</CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap text-xs">
            <Link
              href="/staff/orders"
              className={`px-3 py-1 rounded-full border ${!status ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Toutes ({total})
            </Link>
            {CATALOG_ORDER_STATUSES.map((s) => {
              const n = counts.find((c) => c.status === s)?._count._all ?? 0;
              return (
                <Link
                  key={s}
                  href={`/staff/orders?status=${s}`}
                  className={`px-3 py-1 rounded-full border ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {CATALOG_ORDER_STATUS_LABELS[s]} ({n})
                </Link>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Livraison</TableHead>
                <TableHead className="text-right">Devis</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Reçue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucune commande.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/staff/orders/${o.id}`} className="text-primary hover:underline">
                        {o.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{o.client.name}</div>
                      <div className="text-xs text-muted-foreground">{o.contactPhone ?? o.client.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{o._count.items}</TableCell>
                    <TableCell className="text-sm">{o.deliveryCity ?? "—"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-medium">
                      {o.totalAmount != null ? formatXOF(o.totalAmount) : "À chiffrer"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CATALOG_ORDER_STATUS_TONE[o.status]}>
                        {CATALOG_ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
