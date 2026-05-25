import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatXOF } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente KYC",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  TERMINATED: "Résilié",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "destructive",
  TERMINATED: "secondary",
};

export default async function PartnerHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    include: {
      _count: { select: { shipmentsReferred: true, clientsReferred: true } },
      shipmentsReferred: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          trackingNumber: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
          partnerCommission: true,
          partnerCommissionPaid: true,
          createdAt: true,
        },
      },
    },
  });

  if (!partner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compte partenaire non lié</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Votre compte n'est pas encore associé à une fiche partenaire. Contactez AFRYNTIX.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stats commissions
  const ledger = await prisma.partnerLedger.findMany({
    where: { partnerId: partner.id },
    select: { type: true, amount: true, createdAt: true },
  });
  const totalCommissions = ledger
    .filter((l) => l.type === "COMMISSION_EARNED")
    .reduce((s, l) => s + l.amount, 0);
  const totalReceived = ledger
    .filter((l) => l.type === "PAYOUT")
    .reduce((s, l) => s + Math.abs(l.amount), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Bonjour</div>
              <div className="text-xl font-semibold">{partner.contactName}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {partner.companyName} · {partner.city}, {partner.country}
              </div>
            </div>
            <div className="text-right">
              <Badge variant={STATUS_VARIANT[partner.status]}>{STATUS_LABELS[partner.status]}</Badge>
              <div className="mt-2 text-xs text-muted-foreground">Votre code parrain</div>
              <div className="font-mono text-lg font-bold">{partner.referralCode}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {partner.status !== "ACTIVE" && (
        <div className="rounded-md border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
          {partner.status === "PENDING" && (
            <>Votre compte est en attente de validation KYC. Vous pourrez recevoir des commissions une fois validé.</>
          )}
          {partner.status === "SUSPENDED" && (
            <>Votre partenariat est actuellement suspendu. Contactez AFRYNTIX pour plus d'informations.</>
          )}
          {partner.status === "TERMINATED" && <>Votre partenariat a été résilié.</>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Colis apportés</div>
            <div className="text-2xl font-semibold mt-1">{partner._count.shipmentsReferred}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Clients référencés</div>
            <div className="text-2xl font-semibold mt-1">{partner._count.clientsReferred}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total commissions gagnées</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-700">{formatXOF(totalCommissions)}</div>
            <div className="text-xs text-muted-foreground mt-1">Reçu : {formatXOF(totalReceived)}</div>
          </CardContent>
        </Card>
        <Card className={partner.balance > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Solde à recevoir</div>
            <div className={`text-2xl font-semibold mt-1 ${partner.balance > 0 ? "text-amber-700" : ""}`}>
              {formatXOF(partner.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Derniers colis apportés</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/partner/shipments">Voir tout</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.shipmentsReferred.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Aucun colis pour l'instant. Communiquez votre code parrain à vos clients pour commencer.
                  </TableCell>
                </TableRow>
              ) : (
                partner.shipmentsReferred.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={s.paymentStatus === "FULLY_PAID" ? "success" : "warning"}>
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.partnerCommission != null ? (
                        <span className={s.partnerCommissionPaid ? "text-emerald-700 font-medium" : ""}>
                          {formatXOF(s.partnerCommission)}
                          {s.partnerCommissionPaid && " ✓"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">en attente</span>
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
