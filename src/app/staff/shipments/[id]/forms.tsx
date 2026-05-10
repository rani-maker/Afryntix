"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { updateShipmentStatus, recordShipmentPayment } from "@/server/actions/shipments";
import type { ShipmentStatus } from "@prisma/client";

const STATUSES = Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[];

export function StatusUpdateForm({
  shipmentId,
  currentStatus,
}: {
  shipmentId: string;
  currentStatus: ShipmentStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ShipmentStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await updateShipmentStatus({
      shipmentId,
      status,
      note: note || undefined,
      location: location || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setNote("");
    setLocation("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-4 gap-3 items-end">
      <div className="space-y-1.5">
        <Label htmlFor="status">Nouveau statut</Label>
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Lieu / point de retrait</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ex: Agence Treichville" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="note">Note (optionnel)</Label>
        <Textarea id="note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="sm:col-span-4 flex justify-between items-center">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="ml-auto">
          {loading ? "Mise à jour…" : "Mettre à jour le statut"}
        </Button>
      </div>
    </form>
  );
}

export function RecordPaymentForm({ shipmentId, maxAmount }: { shipmentId: string; maxAmount: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await recordShipmentPayment({ shipmentId, amount: Number(amount) });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setAmount("");
    router.refresh();
  }

  if (maxAmount <= 0) {
    return <div className="text-xs text-muted-foreground">Solde réglé.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="paymentAmount">Encaisser un paiement (FCFA)</Label>
        <Input
          id="paymentAmount"
          type="number"
          step="any"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max ${maxAmount}`}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Enregistrer"}
      </Button>
      {error && <p className="text-xs text-destructive ml-2">{error}</p>}
    </form>
  );
}
