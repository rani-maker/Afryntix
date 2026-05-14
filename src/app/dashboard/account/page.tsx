import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXOF, formatDate, formatDateTime } from "@/lib/utils";
import { TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { Printer } from "lucide-react";

export default async function ClientAccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const clientId = session.user.id;

  const [factures, shipments] = await Promise.all([
    prisma.facture.findMany({
      where: { clientId },
      include: { shipments: { select: { trackingNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shipment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 200,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mon relevé de compte</h2>
          <p className="text-sm text-muted-foreground">
            Récapitulatif de vos factures, paiements et solde restant.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/print/statement" target="_blank">
            <Printer className="h-4 w-4" /> Version imprimable
          </Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard label="Total facturé" value={formatXOF(totals.totalAmount)} />
        <SummaryCard label="Total encaissé" value={formatXOF(totals.amountPaid)} tone="success" />
        <SummaryCard
          label="Solde restant"
          value={formatXOF(totals.remaining)}
          tone={totals.remaining > 0 ? "warning" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factures ({factures.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Colis</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payé</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucune facture pour l&apos;instant.
                  </TableCell>
                </TableRow>
              ) : (
                factures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.reference}</TableCell>
                    <TableCell className="text-xs">{formatDate(f.createdAt)}</TableCell>
                    <TableCell className="text-xs">{f.shipments.length}</TableCell>
                    <TableCell>{formatXOF(f.totalAmount)}</TableCell>
                    <TableCell>{formatXOF(f.amountPaid)}</TableCell>
                    <TableCell className={f.remainingAmount > 0 ? "font-medium" : "text-muted-foreground"}>
                      {formatXOF(f.remainingAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          f.status === "FULLY_PAID"
                            ? "success"
                            : f.status === "DEPOSIT_PAID"
                              ? "info"
                              : f.status === "REFUNDED"
                                ? "secondary"
                                : "warning"
                        }
                      >
                        {f.status === "FULLY_PAID"
                          ? "Soldée"
                          : f.status === "DEPOSIT_PAID"
                            ? "Acompte payé"
                            : f.status === "REFUNDED"
                              ? "Remboursée"
                              : "Impayée"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tous mes colis ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucun colis enregistré.
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/tracking/${s.trackingNumber}`} className="hover:text-primary">
                        {s.trackingNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-xs">{TRANSPORT_MODE_LABELS[s.mode]}</TableCell>
                    <TableCell className="text-xs">
                      {[s.destinationCity, s.destinationCountry].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{formatXOF(s.totalAmount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatXOF(Math.max(0, s.totalAmount - s.amountPaid))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{SHIPMENT_STATUS_LABELS[s.status]}</Badge>
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div
          className={`text-2xl font-bold mt-1 ${
            tone === "warning" ? "text-amber-600" : tone === "success" ? "text-emerald-600" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
