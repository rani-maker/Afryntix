"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addLedgerAdjustment } from "@/server/actions/partners";

export function LedgerAdjustmentForm({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const raw = Number(fd.get("amount"));
    const note = String(fd.get("note") ?? "").trim();
    if (!raw || raw <= 0) {
      setErr("Montant invalide.");
      setLoading(false);
      return;
    }
    if (note.length < 3) {
      setErr("Une note explicative est requise.");
      setLoading(false);
      return;
    }
    const signed = direction === "credit" ? raw : -raw;
    const res = await addLedgerAdjustment({ partnerId, amount: signed, note });
    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg(direction === "credit" ? "Crédit enregistré." : "Débit enregistré.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Utilisez les ajustements pour : bonus exceptionnel, correction comptable, remboursement, pénalité. Tracé dans
        l'audit log.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDirection("credit")}
          className={`flex-1 rounded-md border p-2 text-sm ${
            direction === "credit" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-input"
          }`}
        >
          ➕ Créditer
        </button>
        <button
          type="button"
          onClick={() => setDirection("debit")}
          className={`flex-1 rounded-md border p-2 text-sm ${
            direction === "debit" ? "border-red-500 bg-red-50 text-red-900" : "border-input"
          }`}
        >
          ➖ Débiter
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Montant (FCFA, positif)</Label>
        <Input id="amount" name="amount" type="number" min="1" step="1" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Motif (obligatoire)</Label>
        <Textarea id="note" name="note" rows={2} required placeholder="Ex: Bonus volume Q1 2026" />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={loading} variant={direction === "credit" ? "default" : "outline"}>
        {loading ? "Enregistrement…" : direction === "credit" ? "Créditer le partenaire" : "Débiter le partenaire"}
      </Button>
    </form>
  );
}
