"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateStorageSetting } from "@/server/actions/storage";

export function StorageSettingForm({
  initial,
}: {
  initial: { freeDays: number; dailyRateXOF: number; notes: string };
}) {
  const router = useRouter();
  const [freeDays, setFreeDays] = useState(String(initial.freeDays));
  const [dailyRate, setDailyRate] = useState(String(initial.dailyRateXOF));
  const [notes, setNotes] = useState(initial.notes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const res = await updateStorageSetting({
      freeDays: Number(freeDays),
      dailyRateXOF: Number(dailyRate),
      notes: notes || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="freeDays">Free-time (jours)</Label>
          <Input
            id="freeDays"
            type="number"
            min="0"
            max="365"
            required
            value={freeDays}
            onChange={(e) => setFreeDays(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dailyRate">Tarif par jour (FCFA / colis)</Label>
          <Input
            id="dailyRate"
            type="number"
            min="0"
            step="any"
            required
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes internes (optionnel)</Label>
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
