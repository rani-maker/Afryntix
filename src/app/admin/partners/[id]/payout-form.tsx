"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordPartnerPayout } from "@/server/actions/partners";
import { formatXOF } from "@/lib/utils";

export function PayoutForm({ partnerId, maxAmount }: { partnerId: string; maxAmount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!amount || amount <= 0) {
      setErr("Montant invalide.");
      setLoading(false);
      return;
    }
    const res = await recordPartnerPayout({
      partnerId,
      amount,
      method: fd.get("method") as "MOBILE_MONEY" | "BANK_TRANSFER" | "CASH" | "OTHER",
      notes: String(fd.get("notes") ?? "") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg(`Versement ${res.data?.reference} enregistré.`);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  if (maxAmount <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun solde à verser. Les commissions s'ajoutent automatiquement quand les colis apportés par ce partenaire sont
        intégralement payés.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm">
        Solde disponible : <span className="font-semibold">{formatXOF(maxAmount)}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Montant (FCFA)</Label>
          <Input id="amount" name="amount" type="number" step="1" min="1" max={maxAmount} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Méthode</Label>
          <select
            id="method"
            name="method"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue="MOBILE_MONEY"
          >
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK_TRANSFER">Virement bancaire</option>
            <option value="CASH">Espèces</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (n° transaction, bénéficiaire…)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer le versement"}
      </Button>
    </form>
  );
}
