"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { upsertPricingRule } from "@/server/actions/pricing";

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as Array<keyof typeof TRANSPORT_MODE_LABELS>;
const CATS = Object.keys(CARGO_CATEGORY_LABELS) as Array<keyof typeof CARGO_CATEGORY_LABELS>;
const UNITS = ["kg", "pcs", "cbm", "vehicle", "container"];

export function PricingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await upsertPricingRule({
      mode: fd.get("mode"),
      category: fd.get("category"),
      unit: fd.get("unit"),
      pricePerUnit: fd.get("pricePerUnit"),
      minQuantity: fd.get("minQuantity") || undefined,
      description: fd.get("description") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Tarif enregistré.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mode">Mode</Label>
          <Select id="mode" name="mode" required>
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Select id="category" name="category" required>
            {CATS.map((c) => (
              <option key={c} value={c}>{CARGO_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unité</Label>
          <Select id="unit" name="unit" required>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pricePerUnit">Prix unitaire (FCFA)</Label>
          <Input id="pricePerUnit" name="pricePerUnit" type="number" step="any" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minQuantity">Quantité minimum (optionnel)</Label>
          <Input id="minQuantity" name="minQuantity" type="number" step="any" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer le tarif"}
      </Button>
    </form>
  );
}
