"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { lookupShipmentForWarehouse, type WarehouseShipmentSummary } from "@/server/actions/warehouse";
import { recordVerifiedWeight, updateShipmentStatus } from "@/server/actions/shipments";
import { SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { QrScannerButton, extractTrackingNumber } from "@/components/qr/qr-scanner-button";
import type { ShipmentStatus } from "@prisma/client";

type ShipmentSummary = WarehouseShipmentSummary;

const STATUSES = Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[];

export function WarehouseLookup() {
  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipment, setShipment] = useState<ShipmentSummary | null>(null);

  async function runLookup(tn: string) {
    setError(null);
    setShipment(null);
    if (!tn.trim()) return;
    setLoading(true);
    try {
      const res = await lookupShipmentForWarehouse(tn.trim());
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setShipment(res.data ?? null);
    } catch (e) {
      setLoading(false);
      // Erreur réseau ou session expirée : message lisible plutôt qu'un crash.
      setError(
        e instanceof Error
          ? `Recherche impossible : ${e.message}. Vérifie ta connexion ou reconnecte-toi.`
          : "Recherche impossible. Vérifie ta connexion ou reconnecte-toi.",
      );
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await runLookup(tracking);
  }

  function handleQrDecoded(decoded: string) {
    const tn = extractTrackingNumber(decoded);
    if (!tn) {
      setError(`Code QR illisible : "${decoded.slice(0, 60)}".`);
      return;
    }
    setTracking(tn);
    void runLookup(tn);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleLookup} className="space-y-2">
        <Label htmlFor="lookup">Numéro de suivi</Label>
        <div className="flex gap-2">
          <Input
            id="lookup"
            value={tracking}
            onChange={(e) => setTracking(e.target.value.toUpperCase())}
            placeholder="AFR-A-2026-000123"
            autoFocus
            className="font-mono text-base"
            inputMode="text"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "…" : "Chercher"}
          </Button>
        </div>
        <div className="flex justify-center pt-1">
          <QrScannerButton onDecoded={handleQrDecoded} label="📷 Scanner le QR" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {shipment && (
        <>
          <WeighForm shipment={shipment} onUpdated={(s) => setShipment(s)} />
          <StatusChanger shipment={shipment} onUpdated={(s) => setShipment(s)} />
        </>
      )}
    </div>
  );
}

function WeighForm({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentSummary;
  onUpdated: (s: ShipmentSummary) => void;
}) {
  const [weight, setWeight] = useState(
    shipment.verifiedWeightKg != null
      ? String(shipment.verifiedWeightKg)
      : shipment.declaredWeightKg != null
        ? String(shipment.declaredWeightKg)
        : "",
  );
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    setLoading(true);
    const res = await recordVerifiedWeight({
      shipmentId: shipment.id,
      verifiedWeightKg: Number(weight),
      lengthCm: length ? Number(length) : undefined,
      widthCm: width ? Number(width) : undefined,
      heightCm: height ? Number(height) : undefined,
    });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    const delta = res.data?.delta ?? 0;
    setSuccess(
      delta === 0
        ? `Pesée enregistrée — aucun ajustement`
        : `Pesée OK — ${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString("fr-FR")} FCFA · total ${Math.round(res.data?.newTotal ?? 0).toLocaleString("fr-FR")} FCFA`,
    );
    onUpdated({
      ...shipment,
      verifiedWeightKg: Number(weight),
      weightKg: Number(weight),
      totalAmount: res.data?.newTotal ?? shipment.totalAmount,
    });
  }

  const declared = shipment.declaredWeightKg;
  const w = Number(weight);
  const delta = declared != null && !isNaN(w) && w > 0 ? w - declared : null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="text-sm">
        <div className="font-mono text-base font-semibold">{shipment.trackingNumber}</div>
        <div className="text-xs text-muted-foreground">
          {shipment.clientLabel} · {SHIPMENT_STATUS_LABELS[shipment.status]}
        </div>
        {shipment.description && (
          <div className="text-xs text-muted-foreground mt-1">{shipment.description}</div>
        )}
        <div className="text-xs mt-1">
          Poids déclaré : <strong>{declared != null ? `${declared} kg` : "—"}</strong>
          {shipment.verifiedWeightKg != null && (
            <> · vérifié actuel : <strong>{shipment.verifiedWeightKg} kg</strong></>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="wh-weight">Poids pesé (kg) *</Label>
          <Input
            id="wh-weight"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            className="text-lg h-12"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="wh-l">L (cm)</Label>
            <Input id="wh-l" type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-w">l (cm)</Label>
            <Input id="wh-w" type="number" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-h">H (cm)</Label>
            <Input id="wh-h" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        {delta != null && Math.abs(delta) > 0.05 && (
          <p className={`text-xs ${delta > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            Écart vs déclaré : {delta > 0 ? "+" : ""}{delta.toFixed(2)} kg — recalcul automatique du prix.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !weight} className="flex-1 h-12 text-base">
            {loading ? "…" : "Enregistrer la pesée"}
          </Button>
          <Button asChild type="button" variant="outline" className="h-12">
            <Link href={`/staff/shipments/${shipment.id}`}>Détails</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Changeur de statut inline pour le mode entrepôt.
 *
 * Le staff sur le terrain a souvent besoin de transitionner rapidement
 * un colis (REGISTERED → RECEIVED → READY_TO_SHIP, ou ARRIVED →
 * AVAILABLE_FOR_DELIVERY). On évite de l'envoyer sur la page détail —
 * formulaire compact directement sous le bloc pesée.
 */
function StatusChanger({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentSummary;
  onUpdated: (s: ShipmentSummary) => void;
}) {
  const [status, setStatus] = useState<ShipmentStatus>(shipment.status);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (status === shipment.status) {
      setError("Sélectionnez un statut différent.");
      return;
    }
    setLoading(true);
    const res = await updateShipmentStatus({
      shipmentId: shipment.id,
      status,
      note: note.trim() || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(`Statut → ${SHIPMENT_STATUS_LABELS[status]}`);
    setNote("");
    onUpdated({ ...shipment, status });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="text-sm font-medium">Changer le statut</div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor="wh-status">Nouveau statut</Label>
          <Select
            id="wh-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
            className="h-12 text-base"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {SHIPMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wh-note">Note (optionnel)</Label>
          <Input
            id="wh-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : reçu en entrepôt Guangzhou"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <Button
          type="submit"
          disabled={loading || status === shipment.status}
          className="w-full h-12 text-base"
        >
          {loading ? "…" : "Mettre à jour le statut"}
        </Button>
      </form>
    </div>
  );
}
