"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { upsertClientPricing, deleteClientPricing } from "@/server/actions/contractPricing";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { Trash2 } from "lucide-react";
import type { TransportMode, CargoCategory } from "@prisma/client";

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];
const CATS = Object.keys(CARGO_CATEGORY_LABELS) as CargoCategory[];
const UNITS = ["kg", "pcs", "cbm", "vehicle"] as const;

export function ContractPricingForm({
  clients,
}: {
  clients: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<TransportMode>("AIR_NORMAL");
  const [category, setCategory] = useState<CargoCategory>("ORDINARY");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("kg");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);
    if (!clientId) { setError("Sélectionnez un client"); return; }
    setLoading(true);
    const res = await upsertClientPricing({
      clientId, mode, category, unit, pricePerUnit: Number(price), notes: notes || undefined,
    });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setSuccess(true);
    setPrice(""); setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-6 gap-3">
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="cli">Client</Label>
        <Select id="cli" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          <option value="">— choisir —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cmode">Mode</Label>
        <Select id="cmode" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
          {MODES.map((m) => <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccat">Catégorie</Label>
        <Select id="ccat" value={category} onChange={(e) => setCategory(e.target.value as CargoCategory)}>
          {CATS.map((c) => <option key={c} value={c}>{CARGO_CATEGORY_LABELS[c]}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cunit">Unité</Label>
        <Select id="cunit" value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cprice">Prix (FCFA)</Label>
        <Input id="cprice" type="number" min="0" step="any" required value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="sm:col-span-6 space-y-1.5">
        <Label htmlFor="cnotes">Notes (optionnel)</Label>
        <Textarea id="cnotes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      <div className="sm:col-span-6 flex items-center justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Tarif enregistré.</p>}
        <Button type="submit" disabled={loading} className="ml-auto">
          {loading ? "…" : "Enregistrer le tarif"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteContractPriceButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function handle() {
    if (!confirm("Supprimer ce tarif contractuel ?")) return;
    setLoading(true);
    const res = await deleteClientPricing(id);
    setLoading(false);
    if (!res.success) { alert(res.error); return; }
    router.refresh();
  }
  return (
    <Button size="sm" variant="ghost" onClick={handle} disabled={loading}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
