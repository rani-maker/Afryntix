import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillPaymentStatusBadge } from "@/components/dashboard/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { PublicThemeToggle } from "@/components/public/public-theme-toggle";

export default async function WithdrawDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const raw = decodeURIComponent(code).trim().toUpperCase();
  const stripped = raw.replace(/[^A-Z0-9]/g, "");

  const select = {
    reference: true,
    type: true,
    status: true,
    amountSource: true,
    sourceCurrency: true,
    amountTarget: true,
    targetCurrency: true,
    recipientName: true,
    recipientPhone: true,
    recipientBank: true,
    withdrawalCode: true,
    pickupPersonName: true,
    pickupPersonPhone: true,
    pickupPersonId: true,
    createdAt: true,
    completedAt: true,
    clientName: true,
    client: { select: { name: true } },
    initiatedBy: { select: { name: true } },
    completedBy: { select: { name: true } },
  } as const;

  // Accepte référence (AFR-PAY-2026-XXXXXX) OU code de retrait (8 chars).
  // On essaie : valeur brute (référence avec tirets), puis valeur sans tirets (code retrait avec/sans tirets).
  const payment = await prisma.billPayment.findFirst({
    where: {
      OR: [
        { reference: raw },
        { withdrawalCode: raw },
        { withdrawalCode: stripped },
        { reference: stripped },
      ],
    },
    select,
  });

  if (!payment) redirect("/withdraw?error=notfound");

  const clientLabel = payment.client?.name ?? payment.clientName ?? "—";

  return (
    <main className="min-h-screen bg-muted/20 dark:bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-40">
        <div className="container h-16 flex items-center justify-between">
          <Link href="/" aria-label="AFRYNTIX - accueil"><Logo variant="sm" tone="auto" className="h-9 w-auto" /></Link>
          <div className="flex items-center gap-4">
            <PublicThemeToggle />
            <Link href="/withdraw" className="text-sm hover:text-primary">← Nouvelle recherche</Link>
          </div>
        </div>
      </header>

      <section className="container py-10 max-w-2xl">
        <div className="mb-6">
          <div className="text-sm text-muted-foreground">Code de retrait</div>
          <h1 className="text-2xl md:text-3xl font-mono font-bold">{payment.withdrawalCode}</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Statut du transfert</span>
              <BillPaymentStatusBadge status={payment.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Référence" value={payment.reference} />
            <Row label="Type" value={payment.type === "MONEY_TRANSFER" ? "Transfert / Retrait" : "Paiement de facture"} />
            <Row label="Client" value={clientLabel} />
            <Row label="Bénéficiaire (récupère le montant)" value={payment.recipientName} />
            {payment.recipientPhone && <Row label="Téléphone bénéficiaire" value={payment.recipientPhone} />}
            {payment.recipientBank && <Row label="Banque" value={payment.recipientBank} />}
            <Row
              label="Montant"
              value={`${formatCurrency(payment.amountSource, payment.sourceCurrency)} → ${formatCurrency(payment.amountTarget, payment.targetCurrency)}`}
            />
            <Row label="Initié par (staff)" value={payment.initiatedBy?.name ?? "—"} />
            {payment.completedBy && <Row label="Validé par (staff)" value={payment.completedBy.name} />}
            <Row label="Créé le" value={formatDateTime(payment.createdAt)} />
            {payment.completedAt && <Row label="Complété le" value={formatDateTime(payment.completedAt)} />}
          </CardContent>
        </Card>

        {payment.pickupPersonName && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Personne ayant récupéré le montant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Nom" value={payment.pickupPersonName} />
              {payment.pickupPersonPhone && <Row label="Téléphone" value={payment.pickupPersonPhone} />}
              {payment.pickupPersonId && <Row label="Pièce d'identité" value={payment.pickupPersonId} />}
              {payment.pickupPersonName !== payment.recipientName && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  ⚠️ Cette personne est différente du bénéficiaire initial ({payment.recipientName}).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {payment.status === "WITHDRAWAL_CODE_SENT" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Présentez ce code de retrait au bureau AFRYNTIX en Chine pour récupérer votre montant.
          </div>
        )}
        {payment.status === "COMPLETED" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Ce transfert a été complété{payment.completedAt ? ` le ${formatDateTime(payment.completedAt)}` : ""}.
          </div>
        )}
        {payment.status === "CANCELLED" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Ce transfert a été annulé.
          </div>
        )}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
