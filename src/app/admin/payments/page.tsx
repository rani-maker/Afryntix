import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BillPaymentStatusBadge } from "@/components/dashboard/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function AdminPaymentsPage({
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
        { reference: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { recipientPhone: { contains: search, mode: "insensitive" } },
        { withdrawalCode: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { clientPhone: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { client: { email: { contains: search, mode: "insensitive" } } },
        { client: { phone: { contains: search, mode: "insensitive" } } },
        { initiatedBy: { name: { contains: search, mode: "insensitive" } } },
        { completedBy: { name: { contains: search, mode: "insensitive" } } },
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
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Transferts & Paiements de factures ({payments.length})</CardTitle>
        <form className="flex flex-wrap items-end gap-2" action="/admin/payments">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Recherche</label>
            <Input
              name="q"
              defaultValue={search}
              placeholder="Référence, bénéficiaire, code retrait, client, staff…"
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
              <Link href="/admin/payments">Effacer</Link>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                  {hasFilter ? "Aucun transfert ne correspond aux filtres." : "Aucun transfert pour le moment."}
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
                  <TableCell className="font-mono text-xs">
                    {p.withdrawalCode ?? "—"}
                  </TableCell>
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
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
