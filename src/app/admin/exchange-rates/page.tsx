import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ExchangeRateForm } from "./exchange-rate-form";
import { ExchangeRateRowActions } from "./exchange-rate-row-actions";

export default async function AdminExchangeRatesPage() {
  const rates = await prisma.exchangeRate.findMany({
    orderBy: { date: "desc" },
    include: { setBy: { select: { name: true } } },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Définir le taux du jour</CardTitle>
        </CardHeader>
        <CardContent>
          <ExchangeRateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des taux ({rates.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead>Saisi par</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucun taux défini. Les transferts sont bloqués tant qu'aucun taux du jour n'est saisi.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.fromCcy}</TableCell>
                    <TableCell className="font-medium">{r.toCcy}</TableCell>
                    <TableCell className="text-right font-mono">
                      1 {r.fromCcy} = {r.rate} {r.toCcy}
                    </TableCell>
                    <TableCell className="text-sm">{r.setBy.name}</TableCell>
                    <TableCell className="text-right">
                      <ExchangeRateRowActions
                        id={r.id}
                        fromCcy={r.fromCcy}
                        toCcy={r.toCcy}
                        rate={r.rate}
                      />
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
