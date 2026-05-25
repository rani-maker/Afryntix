import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatXOF } from "@/lib/utils";

const LEDGER_LABELS: Record<string, string> = {
  COMMISSION_EARNED: "Commission",
  PAYOUT: "Versement reçu",
  ADJUSTMENT: "Ajustement",
  REFUND: "Remboursement",
};

export default async function PartnerCommissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    include: {
      ledgerEntries: { orderBy: { createdAt: "desc" } },
      payouts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!partner) redirect("/partner");

  const totalEarned = partner.ledgerEntries
    .filter((l) => l.type === "COMMISSION_EARNED")
    .reduce((s, l) => s + l.amount, 0);
  const totalReceived = partner.payouts
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total commissions gagnées</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-700">{formatXOF(totalEarned)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total reçu</div>
            <div className="text-2xl font-semibold mt-1">{formatXOF(totalReceived)}</div>
          </CardContent>
        </Card>
        <Card className={partner.balance > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Solde en attente de versement</div>
            <div className={`text-2xl font-semibold mt-1 ${partner.balance > 0 ? "text-amber-700" : ""}`}>
              {formatXOF(partner.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des mouvements ({partner.ledgerEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucun mouvement.
                  </TableCell>
                </TableRow>
              ) : (
                partner.ledgerEntries.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={l.type === "PAYOUT" ? "secondary" : "success"}>
                        {LEDGER_LABELS[l.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.note ?? "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${l.amount > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {l.amount > 0 ? "+" : ""}{formatXOF(l.amount)}
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
          <CardTitle>Versements reçus ({partner.payouts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Aucun versement.
                  </TableCell>
                </TableRow>
              ) : (
                partner.payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(p.paidAt ?? p.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{p.method.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "PAID" ? "success" : "warning"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatXOF(p.amount)}</TableCell>
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
