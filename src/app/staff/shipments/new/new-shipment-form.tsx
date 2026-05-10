"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TRANSPORT_MODE_LABELS,
  CARGO_CATEGORY_LABELS,
  computePrice,
  isExpressEligible,
  type PricingResult,
} from "@/lib/pricing";
import { formatXOF } from "@/lib/utils";
import { createShipment } from "@/server/actions/shipments";
import type { TransportMode, CargoCategory } from "@prisma/client";

type Client = { id: string; name: string; email: string; phone: string | null };

type Initial = {
  reservationId?: string;
  clientId?: string;
  mode?: TransportMode;
  category?: CargoCategory;
  weightKg?: string;
  volumeCBM?: string;
};

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];
const CATS = Object.keys(CARGO_CATEGORY_LABELS) as CargoCategory[];

export function NewShipmentForm({ clients, initial }: { clients: Client[]; initial?: Initial }) {
  const router = useRouter();
  const reservationId = initial?.reservationId;
  const [hasAccount, setHasAccount] = useState<boolean>(
    !!initial?.clientId || !!reservationId || clients.length > 0,
  );
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [mode, setMode] = useState<TransportMode>(initial?.mode ?? "AIR_NORMAL");
  const [category, setCategory] = useState<CargoCategory>(initial?.category ?? "ORDINARY");
  const [pieces, setPieces] = useState("1");
  const [weightKg, setWeightKg] = useState(initial?.weightKg ?? "");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [volumeCBM, setVolumeCBM] = useState(initial?.volumeCBM ?? "");
  const [destinationCity, setDestinationCity] = useState("Abidjan");
  const [destinationCountry, setDestinationCountry] = useState("Côte d'Ivoire");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [description, setDescription] = useState("");
  const [overrideUnitPrice, setOverrideUnitPrice] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ trackingNumber: string; id: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const preview: PricingResult | { error: string } | null = useMemo(() => {
    try {
      return computePrice({
        mode,
        category,
        pieces: Number(pieces) || 1,
        weightKg: weightKg ? Number(weightKg) : undefined,
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        volumeCBM: volumeCBM ? Number(volumeCBM) : undefined,
        overrideUnitPrice: overrideUnitPrice ? Number(overrideUnitPrice) : undefined,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erreur" };
    }
  }, [mode, category, pieces, weightKg, lengthCm, widthCm, heightCm, volumeCBM, overrideUnitPrice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await createShipment({
      clientId: hasAccount ? clientId : undefined,
      clientName: hasAccount ? undefined : clientName,
      clientPhone: hasAccount ? undefined : clientPhone,
      mode,
      category,
      description,
      pieces: Number(pieces) || 1,
      weightKg: weightKg ? Number(weightKg) : undefined,
      lengthCm: lengthCm ? Number(lengthCm) : undefined,
      widthCm: widthCm ? Number(widthCm) : undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      volumeCBM: volumeCBM ? Number(volumeCBM) : undefined,
      destinationCity,
      destinationCountry,
      recipientName,
      recipientPhone,
      recipientAddress,
      overrideUnitPrice: overrideUnitPrice ? Number(overrideUnitPrice) : undefined,
      reservationId,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setSuccess({ trackingNumber: res.data.trackingNumber, id: res.data.id });
      router.refresh();
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4">
          <div className="font-semibold text-emerald-900">Expédition enregistrée ✅</div>
          <div className="text-sm text-emerald-800 mt-1">
            Numéro de suivi : <span className="font-mono font-bold">{success.trackingNumber}</span>
          </div>
          <div className="text-sm text-emerald-800 mt-1">
            Notification WhatsApp envoyée au client.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.open(`/print/shipment-label/${success.id}`, "_blank")}>
            Imprimer l&apos;étiquette
          </Button>
          <Button variant="outline" onClick={() => router.push(`/tracking/${success.trackingNumber}`)}>
            Voir le suivi
          </Button>
          <Button variant="ghost" onClick={() => setSuccess(null)}>
            Nouvelle expédition
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
            disabled={!!reservationId}
            className={`px-3 py-1.5 rounded ${!hasAccount ? "bg-background shadow-sm font-medium" : "text-muted-foreground"} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Sans compte
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label htmlFor="mode">Mode</Label>
          <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
      </div>

      {!hasAccount && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="clientPhone">Téléphone du client (WhatsApp)</Label>
            <Input
              id="clientPhone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="ex: +225 07 00 00 00 00"
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as CargoCategory)}>
            {CATS.map((c) => (
              <option key={c} value={c} disabled={mode === "AIR_EXPRESS" && !isExpressEligible(c)}>
                {CARGO_CATEGORY_LABELS[c]}
                {mode === "AIR_EXPRESS" && !isExpressEligible(c) ? " (interdit Express)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pieces">Pièces</Label>
          <Input id="pieces" type="number" min="1" value={pieces} onChange={(e) => setPieces(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weightKg">Poids réel (kg)</Label>
          <Input id="weightKg" type="number" step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lengthCm">Longueur (cm)</Label>
          <Input id="lengthCm" type="number" step="any" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="widthCm">Largeur (cm)</Label>
          <Input id="widthCm" type="number" step="any" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="heightCm">Hauteur (cm)</Label>
          <Input id="heightCm" type="number" step="any" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="volumeCBM">Volume direct (m³)</Label>
          <Input id="volumeCBM" type="number" step="any" value={volumeCBM} onChange={(e) => setVolumeCBM(e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="destinationCity">Ville destination</Label>
          <Input id="destinationCity" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destinationCountry">Pays destination</Label>
          <Input id="destinationCountry" value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="recipientName">Nom du destinataire</Label>
          <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipientPhone">Téléphone destinataire</Label>
          <Input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="overrideUnitPrice">Prix unitaire personnalisé (FCFA)</Label>
          <Input id="overrideUnitPrice" type="number" step="any" value={overrideUnitPrice} onChange={(e) => setOverrideUnitPrice(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recipientAddress">Adresse destinataire</Label>
        <Textarea id="recipientAddress" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description du contenu</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <PricingPreview preview={preview} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || (hasAccount && clients.length === 0)}>
          {loading ? "Enregistrement…" : "Enregistrer & notifier le client"}
        </Button>
      </div>
    </form>
  );
}

function PricingPreview({
  preview,
}: {
  preview: PricingResult | { error: string } | null;
}) {
  if (!preview) return null;
  if ("error" in preview) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ {preview.error}
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-2">
      <div className="text-sm font-semibold">Aperçu tarification</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Prix unitaire</div>
          <div className="font-medium">{formatXOF(preview.unitPrice)} / {preview.unit}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Quantité facturable</div>
          <div className="font-medium">{preview.chargeableQuantity} {preview.unit}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="font-bold text-primary">{formatXOF(preview.totalAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Acompte / Solde</div>
          <div className="font-medium">
            {formatXOF(preview.depositAmount)} / {formatXOF(preview.remainingAmount)}
          </div>
        </div>
      </div>
      {preview.notes.length > 0 && (
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
          {preview.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {preview.isQuote && (
        <div className="text-xs text-amber-800">
          Cette catégorie nécessite un devis manuel — saisissez un prix unitaire personnalisé.
        </div>
      )}
    </div>
  );
}
