"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteShipment } from "@/server/actions/shipments";
import { Trash2 } from "lucide-react";

type Props = {
  shipmentId: string;
  trackingNumber: string;
  isAttachedToEnvoi: boolean;
  amountPaid: number;
  isDelivered: boolean;
};

export function DeleteShipmentCard({
  shipmentId,
  trackingNumber,
  isAttachedToEnvoi,
  amountPaid,
  isDelivered,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = isAttachedToEnvoi || amountPaid > 0 || isDelivered;

  async function onDelete() {
    setLoading(true);
    setError(null);
    const res = await deleteShipment({
      id: shipmentId,
      confirmTrackingNumber: confirmation,
    });
    setLoading(false);
    if (res.success) {
      router.push("/staff/shipments");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (blocked) {
    return (
      <div className="text-sm text-muted-foreground">
        {isAttachedToEnvoi && <p>· Ce colis est rattaché à un envoi — détache-le d&apos;abord.</p>}
        {amountPaid > 0 && (
          <p>· {Math.round(amountPaid).toLocaleString("fr-FR")} FCFA déjà encaissés — rembourse d&apos;abord.</p>
        )}
        {isDelivered && <p>· Colis marqué comme livré — suppression désactivée.</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" /> Supprimer ce colis
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="text-sm text-red-900">
        <div className="font-medium">Confirmer la suppression</div>
        <ul className="list-disc list-inside text-red-800 mt-1 space-y-0.5 text-xs">
          <li>L&apos;historique de statuts et les documents liés seront supprimés.</li>
          <li>Si le colis fait partie d&apos;une facture multi-colis, la facture est recalculée (mais conservée).</li>
          <li>Cette action est irréversible.</li>
        </ul>
      </div>

      <div>
        <Label htmlFor="confirm-tn" className="text-red-900 text-sm">
          Saisis le numéro <span className="font-mono">{trackingNumber}</span> pour confirmer
        </Label>
        <Input
          id="confirm-tn"
          autoFocus
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={trackingNumber}
          className="font-mono"
        />
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
            setError(null);
          }}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={loading || confirmation.trim().toUpperCase() !== trackingNumber.toUpperCase()}
        >
          {loading ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </div>
    </div>
  );
}
