"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteEnvoi } from "@/server/actions/envois";
import { Trash2 } from "lucide-react";

type Props = {
  envoiId: string;
  reference: string;
  shipmentCount: number;
};

export function DeleteEnvoiButton({ envoiId, reference, shipmentCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setLoading(true);
    setError(null);
    const res = await deleteEnvoi({ envoiId, confirmReference: confirmation });
    setLoading(false);
    if (res.success) {
      router.push("/staff/envois");
      router.refresh();
    } else {
      setError(res.error);
    }
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
        <Trash2 className="h-4 w-4" /> Supprimer cet envoi
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="text-sm text-red-900">
        <div className="font-medium">Confirmer la suppression de l&apos;envoi</div>
        <ul className="list-disc list-inside text-red-800 mt-1 space-y-0.5 text-xs">
          <li>
            {shipmentCount > 0
              ? `${shipmentCount} colis seront détachés (ils gardent leur tracking et leur historique).`
              : "Aucun colis rattaché."}
          </li>
          <li>Les conteneurs, l&apos;historique de l&apos;envoi et les documents liés seront supprimés définitivement.</li>
          <li>Une facture liée éventuelle sera dissociée (mais pas effacée).</li>
          <li>La suppression est refusée si une facture liée a déjà reçu un paiement.</li>
        </ul>
      </div>

      <div>
        <Label htmlFor="confirm-ref" className="text-red-900 text-sm">
          Saisis la référence <span className="font-mono">{reference}</span> pour confirmer
        </Label>
        <Input
          id="confirm-ref"
          autoFocus
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={reference}
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
          disabled={loading || confirmation.trim() !== reference}
        >
          {loading ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </div>
    </div>
  );
}
