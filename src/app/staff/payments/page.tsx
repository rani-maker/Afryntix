import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BillPaymentStatusBadge } from "@/components/dashboard/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CompletePaymentButton } from "./row-actions";

export default async function StaffPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { q, from, to } = await searchParams;
  const search = q?.trim() ?? "";
  const fromDate = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999`) : undefined;

  const conditions: Prisma.BillPaymentWhereInput[] = [];
  if (search) {
    conditions.push({
      OR: [
        { withdrawalCode: { equals: search.toUpperCase() } },
        { reference: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (fromDate || toDate) {
    conditions.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }
  const where: Prisma.BillPaymentWhereInput = conditions.length ? { AND: conditions } : {};
  const hasFilter = Boolean(search || fromDate || toDate);

  const payments = await prisma.billPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, email: true } },
      initiatedBy: { select: { name: true } },
      completedBy: { select: { name: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transferts & paiements de factures</h2>
          <p className="text-sm text-muted-foreground">
            Initier un transfert d'argent ou un paiement fournisseur en Chine.
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/payments/new">+ Nouveau transfert / facture</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Historique ({payments.length})</CardTitle>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/staff/payments">
            <div className="flex-1 min-w-[240px]">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Recherche</label>
              <Input
                name="q"
                defaultValue={search}
                placeholder="Code retrait, référence, bénéficiaire…"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Du</label>
              <Input type="date" name="from" defaultValue={from ?? ""} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Au</label>
              <Input type="date" name="to" defaultValue={to ?? ""} />
            </div>
            <Button type="submit" variant="outline">Filtrer</Button>
            {hasFilter && (
              <Button asChild variant="ghost">
                <Link href="/staff/payments">Effacer</Link>
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Bénéficiaire / Récupéré par</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Code retrait</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Initié par</TableHead>
                <TableHead>Validé par</TableHead>
                <TableHead>Créé</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-6">
                    {hasFilter ? "Aucun transfert ne correspond aux filtres." : "Aucun transfert / facture."}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell>
                      <Badge variant={p.type === "MONEY_TRANSFER" ? "info" : "secondary"}>
                        {p.type === "MONEY_TRANSFER" ? "Transfert" : "Facture"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{p.client?.name ?? p.clientName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.client?.email ?? (p.clientPhone ? p.clientPhone : "sans compte")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{p.recipientName}</div>
                      {p.recipientPhone && (
                        <div className="text-xs text-muted-foreground">{p.recipientPhone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {formatCurrency(p.amountSource, p.sourceCurrency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        → {formatCurrency(p.amountTarget, p.targetCurrency)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div>{p.exchangeRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</div>
                      <div className="text-[10px] text-muted-foreground">
                        1 {p.sourceCurrency} = {p.exchangeRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {p.targetCurrency}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.withdrawalCode ?? "—"}</TableCell>
                    <TableCell>
                      <BillPaymentStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-xs">{p.initiatedBy.name}</TableCell>
                    <TableCell className="text-xs">
                      {p.completedBy?.name ?? <span className="text-muted-foreground">—</span>}
                      {p.completedAt && (
                        <div className="text-[10px] text-muted-foreground">
                          {formatDateTime(p.completedAt)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status !== "COMPLETED" && p.status !== "CANCELLED" ? (
                        <CompletePaymentButton id={p.id} recipientName={p.recipientName} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
