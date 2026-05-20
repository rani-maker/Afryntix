"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFclFlatRateInvoice } from "@/server/actions/factures";

type Props = {
  envoiId: string;
  shipmentCount: number;
  existingFlatRate: number | null;
  existingReference: string | null;
  existingPaid: number;
};

export function FclInvoiceForm({
  envoiId,
  shipmentCount,
  existingFlatRate,
  existingReference,
  existingPaid,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>(existingFlatRate?.toString() ?? "");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flatRate = Number(amount);
  const deposit = flatRate > 0 ? Math.round(flatRate * 0.5) : 0;
  const perPackage = shipmentCount > 0 && flatRate > 0 ? Math.round(flatRate / shipmentCount) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flatRate || flatRate <= 0) {
      setMessage({ type: "err", text: "Saisis un montant forfaitaire > 0." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await createFclFlatRateInvoice({
      envoiId,
      flatRateXof: flatRate,
      notes: notes || undefined,
    });
    setLoading(false);
    if (res.success) {
      setMessage({ type: "ok", text: `Facture ${res.data?.reference} ${existingReference ? "mise à jour" : "créée"}.` });
      router.refresh();
    } else {
      setMessage({ type: "err", text: res.error });
    }
  }

  if (shipmentCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Rattache au moins un colis à l&apos;envoi avant de pouvoir le facturer en forfait.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {existingReference && existingFlatRate != null && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-900">
            Facture existante : <span className="font-mono">{existingReference}</span>
          </div>
          <div className="text-amber-800">
            Forfait actuel : {existingFlatRate.toLocaleString("fr-FR")} FCFA · Encaissé : {existingPaid.toLocaleString("fr-FR")} FCFA.
            Modifier le montant ci-dessous revient à renégocier le forfait (les quote-parts seront recalculées).
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="flatRate">Forfait conteneur (FCFA) *</Label>
          <Input
            id="flatRate"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex: 5 800 000"
            required
          />
        </div>
        <div>
          <Label>Acompte (50%)</Label>
          <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm">
            {deposit > 0 ? `${deposit.toLocaleString("fr-FR")} FCFA` : "—"}
          </div>
        </div>
      </div>

      {flatRate > 0 && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm space-y-1">
          <div className="font-medium text-blue-900">Répartition prévue</div>
          <div className="text-blue-800">
            Le forfait sera réparti entre les <strong>{shipmentCount}</strong> colis rattachés
            (proportionnel au CBM si tous les colis ont un volume, sinon parts égales ≈
            <strong> {perPackage.toLocaleString("fr-FR")} FCFA</strong> par colis).
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="fclNotes">Note interne (optionnel)</Label>
        <Textarea
          id="fclNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: forfait négocié à 5,8M incluant LTA Abidjan"
        />
      </div>

      {message && (
        <div className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-700"}`}>
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading
          ? "Enregistrement…"
          : existingReference
            ? "Mettre à jour le forfait"
            : "Créer la facture forfaitaire"}
      </Button>
    </form>
  );
}
