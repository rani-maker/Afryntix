import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatXOF } from "@/lib/utils";
import { KycForm } from "./kyc-form";
import { PayoutForm } from "./payout-form";
import { LoginSection } from "./login-section";
import { EditPartnerForm } from "./edit-partner-form";
import { LedgerAdjustmentForm } from "./ledger-adjustment-form";

const TYPE_LABELS: Record<string, string> = {
  APPORTEUR: "Apporteur d'affaires",
  REVENDEUR: "Revendeur",
  TRANSPORTEUR_RELAIS: "Transporteur relais",
  AGENT_CHINE: "Agent Chine",
  CONFRERE_FORWARDER: "Confrère forwarder",
};

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

const COMMISSION_LABELS: Record<string, string> = {
  PERCENT_OF_REVENUE: "% sur CA encaissé",
  PERCENT_OF_MARGIN: "% sur marge brute",
  FIXED_PER_SHIPMENT: "Forfait / colis",
  FIXED_PER_KG: "Forfait / kg",
  FIXED_PER_CBM: "Forfait / CBM",
  WHOLESALE_TARIFF: "Tarif gros",
};

const LEDGER_LABELS: Record<string, string> = {
  COMMISSION_EARNED: "Commission",
  PAYOUT: "Versement",
  ADJUSTMENT: "Ajustement",
  REFUND: "Remboursement",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, active: true } },
      shipmentsReferred: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          trackingNumber: true,
          totalAmount: true,
          paymentStatus: true,
          partnerCommission: true,
          partnerCommissionPaid: true,
          status: true,
          createdAt: true,
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { shipmentsReferred: true, clientsReferred: true } },
    },
  });

  if (!partner) notFound();

  const totalCommissions = partner.ledgerEntries
    .filter((l) => l.type === "COMMISSION_EARNED")
    .reduce((sum, l) => sum + l.amount, 0);
  const totalPaidOut = partner.payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/partners" className="text-sm text-muted-foreground hover:underline">
              ← Partenaires
            </Link>
          </div>
          <h1 className="text-2xl font-semibold mt-1">{partner.companyName}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="font-mono text-muted-foreground">{partner.code}</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="info">{TYPE_LABELS[partner.type]}</Badge>
            <Badge variant={STATUS_VARIANT[partner.status]}>{STATUS_LABELS[partner.status]}</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Code parrain à communiquer</div>
          <div className="font-mono text-lg font-bold">{partner.referralCode}</div>
        </div>
      </div>

      {/* KPIs */}
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
            <div className="text-xs text-muted-foreground mt-1">Versé : {formatXOF(totalPaidOut)}</div>
          </CardContent>
        </Card>
        <Card className={partner.balance > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Solde dû</div>
            <div className={`text-2xl font-semibold mt-1 ${partner.balance > 0 ? "text-amber-700" : ""}`}>
              {formatXOF(partner.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fiche éditable */}
        <Card>
          <CardHeader>
            <CardTitle>Fiche partenaire</CardTitle>
          </CardHeader>
          <CardContent>
            <EditPartnerForm partner={partner} />
          </CardContent>
        </Card>

        {/* KYC */}
        <Card>
          <CardHeader>
            <CardTitle>KYC & Contrat</CardTitle>
          </CardHeader>
          <CardContent>
            <KycForm
              partnerId={partner.id}
              idDocumentNumber={partner.idDocumentNumber}
              idDocumentUrl={partner.idDocumentUrl}
              contractUrl={partner.contractUrl}
              contractSignedAt={partner.contractSignedAt}
            />
          </CardContent>
        </Card>

        {/* Compte de connexion */}
        <Card>
          <CardHeader>
            <CardTitle>Compte de connexion (portail partenaire)</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginSection
              partnerId={partner.id}
              currentEmail={partner.email}
              hasUser={!!partner.user}
              userActive={partner.user?.active ?? false}
              userEmail={partner.user?.email ?? null}
            />
          </CardContent>
        </Card>

        {/* Enregistrer un versement */}
        <Card>
          <CardHeader>
            <CardTitle>Enregistrer un versement</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutForm partnerId={partner.id} maxAmount={partner.balance} />
          </CardContent>
        </Card>

        {/* Ajustement manuel du ledger */}
        <Card>
          <CardHeader>
            <CardTitle>Ajustement manuel du compte courant</CardTitle>
          </CardHeader>
          <CardContent>
            <LedgerAdjustmentForm partnerId={partner.id} />
          </CardContent>
        </Card>
      </div>

      {/* Compte courant (ledger) */}
      <Card>
        <CardHeader>
          <CardTitle>Compte courant ({partner.ledgerEntries.length})</CardTitle>
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
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(l.createdAt)}
                    </TableCell>
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

      {/* Versements */}
      <Card>
        <CardHeader>
          <CardTitle>Versements ({partner.payouts.length})</CardTitle>
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

      {/* Colis apportés */}
      <Card>
        <CardHeader>
          <CardTitle>Colis apportés (50 derniers)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partner.shipmentsReferred.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucun colis apporté pour l'instant.
                  </TableCell>
                </TableRow>
              ) : (
                partner.shipmentsReferred.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/admin/shipments/${s.id}`} className="hover:underline">
                        {s.trackingNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.paymentStatus === "FULLY_PAID" ? "success" : "warning"}>
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatXOF(s.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      {s.partnerCommission != null ? (
                        <span className={s.partnerCommissionPaid ? "text-emerald-700 font-medium" : ""}>
                          {formatXOF(s.partnerCommission)}
                          {s.partnerCommissionPaid && " ✓"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">en attente</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/partners">Retour à la liste</Link>
        </Button>
      </div>
    </div>
  );
}
