"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateEnvoiStatus } from "@/server/actions/envois";
import { ENVOI_STATUS_LABELS, envoiStatusToShipmentStatus, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import type { EnvoiStatus } from "@prisma/client";

const STATUSES: EnvoiStatus[] = [
  "PLANNED", "LOADING", "DEPARTED", "IN_TRANSIT", "ARRIVED", "CLEARED", "DELIVERED", "CANCELLED",
];

export function EnvoiStatusForm({
  envoiId,
  currentStatus,
  shipmentCount,
}: {
  envoiId: string;
  currentStatus: EnvoiStatus;
  shipmentCount: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EnvoiStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [cascade, setCascade] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cascadeTarget = envoiStatusToShipmentStatus(status);
  const cascadeLabel = cascadeTarget ? SHIPMENT_STATUS_LABELS[cascadeTarget] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = await updateEnvoiStatus({ envoiId, status, note: note || undefined, cascadeToShipments: cascade });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setInfo(
      res.data?.cascaded
        ? `Statut mis à jour. ${res.data.cascaded} colis également mis à jour.`
        : "Statut mis à jour.",
    );
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Nouveau statut</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EnvoiStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{ENVOI_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Note (optionnelle)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={cascade}
          onChange={(e) => setCascade(e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>Appliquer aux {shipmentCount} colis</strong> rattachés
          {cascadeLabel ? (
            <> (statut colis cible : <strong>{cascadeLabel}</strong>)</>
          ) : (
            <> (le statut <em>{ENVOI_STATUS_LABELS[status]}</em> ne cascade pas — seul l&apos;envoi sera mis à jour).</>
          )}
        </span>
      </label>

      <Button type="submit" disabled={loading}>
        {loading ? "Mise à jour…" : "Mettre à jour"}
      </Button>
    </form>
  );
}
