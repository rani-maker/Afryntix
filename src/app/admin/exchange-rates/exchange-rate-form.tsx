"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { setExchangeRate } from "@/server/actions/payments";

const CCYS = ["XOF", "RMB", "EUR", "USD"] as const;

export function ExchangeRateForm() {
  const router = useRouter();
  const [fromCcy, setFromCcy] = useState<(typeof CCYS)[number]>("RMB");
  const [toCcy, setToCcy] = useState<(typeof CCYS)[number]>("XOF");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await setExchangeRate({ fromCcy, toCcy, rate: Number(rate) });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(`Taux ${fromCcy}→${toCcy} = ${rate} enregistré pour aujourd'hui.`);
    setRate("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fromCcy">Devise source</Label>
          <Select id="fromCcy" value={fromCcy} onChange={(e) => setFromCcy(e.target.value as (typeof CCYS)[number])}>
            {CCYS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toCcy">Devise cible</Label>
          <Select id="toCcy" value={toCcy} onChange={(e) => setToCcy(e.target.value as (typeof CCYS)[number])}>
            {CCYS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate">Taux (1 {fromCcy} = ? {toCcy})</Label>
          <Input
            id="rate"
            type="number"
            step="any"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="ex: 82.5"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer le taux"}
      </Button>
    </form>
  );
}
