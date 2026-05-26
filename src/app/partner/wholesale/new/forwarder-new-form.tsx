"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createForwarderShipment, previewForwarderPricing } from "@/server/actions/partners";
import { formatXOF } from "@/lib/utils";

const TRANSPORT_MODES = [
  { value: "AIR_EXPRESS", label: "Aérien Express" },
  { value: "AIR_NORMAL", label: "Aérien Normal" },
  { value: "SEA_LCL", label: "Maritime LCL (groupage)" },
  { value: "SEA_FCL", label: "Maritime FCL (conteneur)" },
];

const CATEGORIES = [
  { value: "ORDINARY", label: "Ordinaire" },
  { value: "BATTERY", label: "Avec batterie" },
  { value: "LIQUID", label: "Liquide" },
  { value: "COSMETIC", label: "Cosmétique" },
  { value: "POWDER", label: "Poudre" },
  { value: "PHONE", label: "Téléphone" },
  { value: "COMPUTER", label: "Ordinateur" },
  { value: "OTHER", label: "Autre" },
];

export function ForwarderNewForm({ discountPercent }: { discountPercent: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<string>("SEA_LCL");
  const [category, setCategory] = useState<string>("ORDINARY");
  const [pieces, setPieces] = useState<string>("1");
  const [weightKg, setWeightKg] = useState<string>("");
  const [lengthCm, setLengthCm] = useState<string>("");
  const [widthCm, setWidthCm] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [volumeCBM, setVolumeCBM] = useState<string>("");

  const [preview, setPreview] = useState<{
    publicTotal: number;
    wholesaleTotal: number;
    discountPercent: number;
    unit: string;
    chargeableQuantity: number;
  } | null>(null);

  // Recalcule le tarif quand les inputs changent
  useEffect(() => {
    const hasWeight = !!weightKg && Number(weightKg) > 0;
    const hasDim = !!lengthCm && !!widthCm && !!heightCm;
    const hasVol = !!volumeCBM && Number(volumeCBM) > 0;
    if (!hasWeight && !hasDim && !hasVol) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await previewForwarderPricing({
        mode,
        category,
        pieces: Number(pieces) || 1,
        weightKg: hasWeight ? Number(weightKg) : undefined,
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        volumeCBM: hasVol ? Number(volumeCBM) : undefined,
      });
      if (res.success && res.data) setPreview(res.data);
      else setPreview(null);
    }, 300);
    return () => clearTimeout(t);
  }, [mode, category, pieces, weightKg, lengthCm, widthCm, heightCm, volumeCBM]);

  const isAir = mode.startsWith("AIR");
  const isSea = mode.startsWith("SEA");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const num = (n: string) => {
      const v = fd.get(n);
      return v && String(v).trim() ? Number(v) : undefined;
    };

    const res = await createForwarderShipment({
      mode: mode as "AIR_EXPRESS" | "AIR_NORMAL" | "SEA_LCL" | "SEA_FCL" | "VEHICLE" | "BTP_EQUIPMENT" | "STORAGE",
      category: category as "ORDINARY" | "BATTERY" | "LIQUID" | "COSMETIC" | "POWDER" | "PHONE" | "COMPUTER" | "VEHICLE" | "BTP" | "OTHER",
      description: String(fd.get("description") ?? "") || undefined,
      supplierTrackingNumber: String(fd.get("supplierTrackingNumber") ?? "") || undefined,
      pieces: Number(pieces) || 1,
      weightKg: num("weightKg"),
      lengthCm: num("lengthCm"),
      widthCm: num("widthCm"),
      heightCm: num("heightCm"),
      volumeCBM: num("volumeCBM"),
      destinationCity: String(fd.get("destinationCity") ?? "").trim(),
      destinationCountry: String(fd.get("destinationCountry") ?? "") || undefined,
      recipientName: String(fd.get("recipientName") ?? "").trim(),
      recipientPhone: String(fd.get("recipientPhone") ?? "").trim(),
      recipientAddress: String(fd.get("recipientAddress") ?? "") || undefined,
    });

    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    router.push("/partner/wholesale");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Colis</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode *</Label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TRANSPORT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Catégorie *</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplierTrackingNumber">N° fournisseur Chine</Label>
            <Input id="supplierTrackingNumber" name="supplierTrackingNumber" placeholder="Ex: SF1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Ex: 5 cartons pièces auto" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Mesures</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pieces">Pièces</Label>
            <Input id="pieces" type="number" min="1" value={pieces} onChange={(e) => setPieces(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weightKg">Poids (kg)</Label>
            <Input id="weightKg" name="weightKg" type="number" step="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" />
          </div>
          {(isAir || isSea) && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="lengthCm">L (cm)</Label>
                <Input id="lengthCm" name="lengthCm" type="number" step="0.1" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="widthCm">l (cm)</Label>
                <Input id="widthCm" name="widthCm" type="number" step="0.1" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heightCm">H (cm)</Label>
                <Input id="heightCm" name="heightCm" type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" />
              </div>
            </>
          )}
          {isSea && (
            <div className="space-y-1.5">
              <Label htmlFor="volumeCBM">CBM (direct)</Label>
              <Input id="volumeCBM" name="volumeCBM" type="number" step="0.001" value={volumeCBM} onChange={(e) => setVolumeCBM(e.target.value)} inputMode="decimal" />
            </div>
          )}
        </div>
      </div>

      {/* Aperçu tarif */}
      {preview && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4">
          <div className="text-xs text-emerald-900 font-medium uppercase tracking-wide">Aperçu tarif</div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Tarif public</div>
              <div className="font-medium line-through text-muted-foreground">{formatXOF(preview.publicTotal)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remise gros</div>
              <div className="font-medium"><Badge variant="info">-{preview.discountPercent}%</Badge></div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Votre tarif gros</div>
              <div className="text-lg font-bold text-emerald-700">{formatXOF(preview.wholesaleTotal)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Quantité facturable : {preview.chargeableQuantity.toFixed(2)} {preview.unit}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Destinataire en Afrique</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipientName">Nom *</Label>
            <Input id="recipientName" name="recipientName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipientPhone">Téléphone *</Label>
            <Input id="recipientPhone" name="recipientPhone" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destinationCity">Ville destination *</Label>
            <Input id="destinationCity" name="destinationCity" required defaultValue="Abidjan" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destinationCountry">Pays</Label>
            <Input id="destinationCountry" name="destinationCountry" defaultValue="Côte d'Ivoire" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipientAddress">Adresse de livraison</Label>
          <Textarea id="recipientAddress" name="recipientAddress" rows={2} />
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Création…" : "Créer le colis"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le colis est créé immédiatement avec un numéro de suivi. Vous serez facturé à votre tarif négocié — vous facturez librement votre client final.
      </p>
    </form>
  );
}
