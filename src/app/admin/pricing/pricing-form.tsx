"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { upsertPricingRule } from "@/server/actions/pricing";
import type { TransportMode, CargoCategory } from "@prisma/client";

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as Array<keyof typeof TRANSPORT_MODE_LABELS>;
const CATS = Object.keys(CARGO_CATEGORY_LABELS) as Array<keyof typeof CARGO_CATEGORY_LABELS>;
const UNITS = ["kg", "pcs", "cbm", "vehicle", "container"];

/**
 * Formulaire d'upsert d'une règle tarifaire.
 *
 * Le bouton « Modifier » de la table parente passe les valeurs courantes
 * via la prop `initial`. Le composant détecte le changement de `initial`
 * (via `key={...}` côté parent OU via `useEffect` interne) et re-remplit
 * les champs. À la soumission, `upsertPricingRule` met à jour la ligne
 * si (mode + catégorie + unité + minQuantity) correspond, ou en crée
 * une nouvelle sinon.
 */
export function PricingForm({
  initial,
  onSaved,
}: {
  initial?: {
    mode: TransportMode;
    category: CargoCategory;
    unit: string;
    pricePerUnit: number;
    minQuantity: number | null;
    description: string | null;
  };
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<TransportMode>(initial?.mode ?? "AIR_NORMAL");
  const [category, setCategory] = useState<CargoCategory>(initial?.category ?? "ORDINARY");
  const [unit, setUnit] = useState<string>(initial?.unit ?? "kg");
  const [pricePerUnit, setPricePerUnit] = useState<string>(
    initial?.pricePerUnit != null ? String(initial.pricePerUnit) : "",
  );
  const [minQuantity, setMinQuantity] = useState<string>(
    initial?.minQuantity != null ? String(initial.minQuantity) : "",
  );
  const [description, setDescription] = useState<string>(initial?.description ?? "");

  // Si le parent recharge le formulaire avec une autre ligne, on resynchronise.
  useEffect(() => {
    if (!initial) return;
    setMode(initial.mode);
    setCategory(initial.category);
    setUnit(initial.unit);
    setPricePerUnit(String(initial.pricePerUnit));
    setMinQuantity(initial.minQuantity != null ? String(initial.minQuantity) : "");
    setDescription(initial.description ?? "");
    setError(null);
    setSuccess(null);
  }, [initial]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await upsertPricingRule({
      mode,
      category,
      unit,
      pricePerUnit,
      minQuantity: minQuantity || undefined,
      description: description || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(initial ? "Tarif mis à jour." : "Tarif enregistré.");
    // En mode création (pas d'initial), on vide les champs prix/min pour
    // permettre une saisie consécutive ; en mode édition, on garde les
    // valeurs (l'admin peut continuer à ajuster).
    if (!initial) {
      setPricePerUnit("");
      setMinQuantity("");
      setDescription("");
    }
    onSaved?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          ✏️ Mode édition : {TRANSPORT_MODE_LABELS[initial.mode]} ·{" "}
          {CARGO_CATEGORY_LABELS[initial.category]} · {initial.unit}
          {initial.minQuantity != null && <> · min {initial.minQuantity}</>}
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mode">Mode</Label>
          <Select
            id="mode"
            name="mode"
            required
            value={mode}
            onChange={(e) => setMode(e.target.value as TransportMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Select
            id="category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as CargoCategory)}
          >
            {CATS.map((c) => (
              <option key={c} value={c}>{CARGO_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unité</Label>
          <Select
            id="unit"
            name="unit"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pricePerUnit">Prix unitaire (FCFA)</Label>
          <Input
            id="pricePerUnit"
            name="pricePerUnit"
            type="number"
            step="any"
            required
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minQuantity">Quantité minimum (optionnel)</Label>
          <Input
            id="minQuantity"
            name="minQuantity"
            type="number"
            step="any"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            placeholder="ex: 5 (LCL dégressif)"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : initial ? "Mettre à jour" : "Enregistrer le tarif"}
        </Button>
        {initial && onSaved && (
          <Button type="button" variant="ghost" onClick={onSaved}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
