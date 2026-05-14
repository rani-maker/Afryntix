"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateInsuranceSetting } from "@/server/actions/insurance";

export function InsuranceSettingForm({
  initial,
}: {
  initial: { ratePercent: number; minPremiumXOF: number; maxCoverageXOF: number; notes: string };
}) {
  const router = useRouter();
  const [rate, setRate] = useState(String(initial.ratePercent));
  const [minPrem, setMinPrem] = useState(String(initial.minPremiumXOF));
  const [maxCov, setMaxCov] = useState(String(initial.maxCoverageXOF));
  const [notes, setNotes] = useState(initial.notes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const res = await updateInsuranceSetting({
      ratePercent: Number(rate),
      minPremiumXOF: Number(minPrem),
      maxCoverageXOF: Number(maxCov),
      notes: notes || undefined,
    });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rate">Taux (% de la valeur)</Label>
          <Input id="rate" type="number" step="0.01" min="0" max="100" required value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="min">Prime plancher (FCFA)</Label>
          <Input id="min" type="number" min="0" required value={minPrem} onChange={(e) => setMinPrem(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">Couverture max (FCFA)</Label>
          <Input id="max" type="number" min="0" required value={maxCov} onChange={(e) => setMaxCov(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes internes</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      <div className="flex items-center justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Paramètres enregistrés.</p>}
        <Button type="submit" disabled={loading} className="ml-auto">
          {loading ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
