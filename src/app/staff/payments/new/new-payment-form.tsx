"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBillPayment } from "@/server/actions/payments";
import { formatCurrency } from "@/lib/utils";
import type { Currency, BillPaymentType } from "@prisma/client";

type Client = { id: string; name: string; email: string; phone: string | null; whatsapp: string | null };
type Rate = { fromCcy: Currency; toCcy: Currency; rate: number };

const CURRENCIES: Currency[] = ["XOF", "RMB", "EUR", "USD"];

export function NewPaymentForm({ clients, rates }: { clients: Client[]; rates: Rate[] }) {
  const router = useRouter();
  const [type, setType] = useState<BillPaymentType>("MONEY_TRANSFER");
  const [hasAccount, setHasAccount] = useState<boolean>(clients.length > 0);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [amountSource, setAmountSource] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState<Currency>("XOF");
  const [targetCurrency, setTargetCurrency] = useState<Currency>("RMB");
  const [fees, setFees] = useState("0");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [showBankDetails, setShowBankDetails] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reference: string; withdrawalCode?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const todayRate = useMemo(() => {
    if (sourceCurrency === targetCurrency) return 1;
    return rates.find((r) => r.fromCcy === sourceCurrency && r.toCcy === targetCurrency)?.rate ?? null;
  }, [rates, sourceCurrency, targetCurrency]);

  const computedTarget = useMemo(() => {
    const amt = Number(amountSource);
    const f = Number(fees) || 0;
    if (!amt || todayRate === null) return null;
    return Math.round((amt * todayRate + f) * 100) / 100;
  }, [amountSource, fees, todayRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (todayRate === null) {
      setError("Aucun taux de change défini aujourd'hui pour cette paire. L'admin doit le saisir d'abord.");
      return;
    }
    setLoading(true);
    const res = await createBillPayment({
      type,
      clientId: hasAccount ? clientId : undefined,
      clientName: hasAccount ? undefined : clientName,
      clientPhone: hasAccount ? undefined : clientPhone,
      amountSource: Number(amountSource),
      sourceCurrency,
      targetCurrency,
      fees: Number(fees) || 0,
      recipientName,
      recipientPhone: recipientPhone || undefined,
      recipientId: showBankDetails && recipientId ? recipientId : undefined,
      recipientBank: showBankDetails && recipientBank ? recipientBank : undefined,
      recipientAccount: showBankDetails && recipientAccount ? recipientAccount : undefined,
      recipientAddress: showBankDetails && recipientAddress ? recipientAddress : undefined,
      invoiceNumber: type === "INVOICE_PAYMENT" ? invoiceNumber : undefined,
      notes: notes || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setSuccess(res.data);
      router.refresh();
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4 space-y-2">
          <div className="font-semibold text-emerald-900">Paiement enregistré ✅</div>
          <div className="text-sm text-emerald-800">
            Référence : <span className="font-mono font-bold">{success.reference}</span>
          </div>
          {success.withdrawalCode && (
            <div className="text-sm text-emerald-800">
              Code de retrait :{" "}
              <span className="font-mono font-bold">{success.withdrawalCode}</span> — envoyé au client par WhatsApp.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSuccess(null)}>Nouveau paiement</Button>
          <Button variant="outline" onClick={() => router.push("/staff/payments")}>
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setHasAccount(true)}
            className={`px-3 py-1.5 rounded ${hasAccount ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Client enregistré
          </button>
          <button
            type="button"
            onClick={() => setHasAccount(false)}
            className={`px-3 py-1.5 rounded ${!hasAccount ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Sans compte
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as BillPaymentType)}>
            <option value="MONEY_TRANSFER">Transfert / Retrait</option>
            <option value="INVOICE_PAYMENT">Paiement de facture fournisseur</option>
          </Select>
        </div>
        {hasAccount ? (
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select id="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.length === 0 ? (
                <option value="">Aucun client actif</option>
              ) : (
                clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </option>
                ))
              )}
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Nom du client</Label>
            <Input
              id="clientName"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="ex: Awa Diop"
            />
          </div>
        )}
      </div>

      {!hasAccount && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="clientPhone">Téléphone du client (WhatsApp pour code retrait)</Label>
            <Input
              id="clientPhone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="ex: +225 07 00 00 00 00"
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amountSource">Montant source</Label>
          <Input
            id="amountSource"
            type="number"
            step="any"
            required
            value={amountSource}
            onChange={(e) => setAmountSource(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceCurrency">Devise source</Label>
          <Select id="sourceCurrency" value={sourceCurrency} onChange={(e) => setSourceCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetCurrency">Devise cible</Label>
          <Select id="targetCurrency" value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fees">Frais (devise cible)</Label>
          <Input id="fees" type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        {sourceCurrency === targetCurrency ? (
          <div className="text-muted-foreground">
            Devises identiques — aucune conversion. Saisissez les frais éventuels.
          </div>
        ) : todayRate === null ? (
          <div className="text-amber-800">
            ⚠️ Aucun taux de change défini aujourd'hui pour {sourceCurrency} → {targetCurrency}. L'admin doit le saisir
            via /admin/exchange-rates avant de pouvoir créer ce paiement.
          </div>
        ) : (
          <div className="space-y-1">
            <div>
              Taux du jour : <span className="font-medium">1 {sourceCurrency} = {todayRate} {targetCurrency}</span>
            </div>
            {computedTarget !== null && (
              <div>
                Montant cible : <span className="font-bold">{formatCurrency(computedTarget, targetCurrency)}</span>
                {Number(fees) > 0 && (
                  <span className="text-xs text-muted-foreground"> (frais inclus : {formatCurrency(Number(fees), targetCurrency)})</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <fieldset className="space-y-3 border rounded-md p-4">
        <legend className="text-sm font-medium px-2">Bénéficiaire</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipientName">Nom du bénéficiaire</Label>
            <Input
              id="recipientName"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipientPhone">Téléphone</Label>
            <Input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
          </div>
        </div>

        {type === "INVOICE_PAYMENT" && (
          <div className="space-y-1.5">
            <Label htmlFor="invoiceNumber">N° facture</Label>
            <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
        )}

        {!showBankDetails ? (
          <button
            type="button"
            onClick={() => setShowBankDetails(true)}
            className="text-sm text-primary hover:underline"
          >
            + Ajouter des détails bancaires (optionnel)
          </button>
        ) : (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Détails bancaires (optionnel)</span>
              <button
                type="button"
                onClick={() => setShowBankDetails(false)}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Masquer
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recipientId">Pièce d&apos;identité (n°)</Label>
                <Input id="recipientId" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientBank">Banque</Label>
                <Input id="recipientBank" value={recipientBank} onChange={(e) => setRecipientBank(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipientAccount">Compte / IBAN</Label>
              <Input
                id="recipientAccount"
                value={recipientAccount}
                onChange={(e) => setRecipientAccount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipientAddress">Adresse</Label>
              <Textarea
                id="recipientAddress"
                rows={2}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes internes</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || (hasAccount && clients.length === 0)}>
          {loading ? "Enregistrement…" : "Enregistrer le paiement"}
        </Button>
      </div>
    </form>
  );
}
