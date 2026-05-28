"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Partner } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePartner } from "@/server/actions/partners";

const COMMISSION_MODELS: { value: string; label: string; unit: string; isPercent: boolean }[] = [
  { value: "PERCENT_OF_REVENUE", label: "% sur CA encaissé", unit: "%", isPercent: true },
  { value: "PERCENT_OF_MARGIN", label: "% sur marge brute", unit: "%", isPercent: true },
  { value: "FIXED_PER_SHIPMENT", label: "Forfait / colis", unit: "XOF", isPercent: false },
  { value: "FIXED_PER_KG", label: "Forfait / kg", unit: "XOF / kg", isPercent: false },
  { value: "FIXED_PER_CBM", label: "Forfait / CBM", unit: "XOF / CBM", isPercent: false },
  { value: "WHOLESALE_TARIFF", label: "Tarif gros (remise %)", unit: "%", isPercent: true },
];

export function EditPartnerForm({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<string>(partner.commissionModel);
  const [rate, setRate] = useState<string>(
    partner.commissionRate != null ? String(partner.commissionRate) : "",
  );

  const currentModel = COMMISSION_MODELS.find((m) => m.value === model);
  const modelChanged = model !== partner.commissionModel;
  const rateChanged =
    (rate === "" ? null : Number(rate)) !== (partner.commissionRate ?? null);
  const commissionChanged = modelChanged || rateChanged;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const serviceAreas = String(fd.get("serviceAreas") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await updatePartner({
      id: partner.id,
      companyName: String(fd.get("companyName") ?? ""),
      legalForm: String(fd.get("legalForm") ?? "") || undefined,
      taxId: String(fd.get("taxId") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? ""),
      whatsapp: String(fd.get("whatsapp") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      country: String(fd.get("country") ?? ""),
      city: String(fd.get("city") ?? ""),
      serviceAreas,
      commissionModel: model as
        | "PERCENT_OF_REVENUE"
        | "PERCENT_OF_MARGIN"
        | "FIXED_PER_SHIPMENT"
        | "FIXED_PER_KG"
        | "FIXED_PER_CBM"
        | "WHOLESALE_TARIFF",
      commissionRate: rate.trim() ? Number(rate) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg(
      commissionChanged
        ? "Fiche mise à jour. Renégociation enregistrée dans l'historique."
        : "Fiche mise à jour.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Société</Label>
          <Input id="companyName" name="companyName" defaultValue={partner.companyName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legalForm">Forme juridique</Label>
          <Input id="legalForm" name="legalForm" defaultValue={partner.legalForm ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact</Label>
          <Input id="contactName" name="contactName" defaultValue={partner.contactName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxId">N° RCCM</Label>
          <Input id="taxId" name="taxId" defaultValue={partner.taxId ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Téléphone</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={partner.contactPhone} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" defaultValue={partner.whatsapp ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={partner.email ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" defaultValue={partner.country} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={partner.city} required />
        </div>
      </div>

      {/* Bloc commission — renégociation */}
      <div
        className={`rounded-md border p-3 space-y-3 ${
          commissionChanged
            ? "border-amber-300 bg-amber-50/50"
            : "border-border bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Commission négociée</div>
            <div className="text-xs text-muted-foreground">
              Changer le modèle ou le taux enregistre l'événement dans l'historique
              (audit). Les colis déjà créés conservent leur commission d'origine ;
              seuls les nouveaux colis utilisent les nouvelles valeurs.
            </div>
          </div>
          {commissionChanged && (
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Renégociation
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="commissionModel">Modèle</Label>
            <select
              id="commissionModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {COMMISSION_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commissionRate">
              Valeur {currentModel ? `(${currentModel.unit})` : ""}
            </Label>
            <Input
              id="commissionRate"
              name="commissionRate"
              type="number"
              step="0.01"
              min="0"
              max={currentModel?.isPercent ? "100" : undefined}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={
                currentModel?.isPercent ? "ex. 5 = 5 %" : "ex. 500 = 500 XOF"
              }
            />
            {currentModel?.isPercent && Number(rate) > 100 && (
              <p className="text-xs text-destructive">
                Un taux % doit être entre 0 et 100.
              </p>
            )}
          </div>
        </div>
        {commissionChanged && (
          <div className="text-xs space-y-0.5">
            <div>
              <span className="text-muted-foreground">Avant :</span>{" "}
              <span className="font-mono">
                {COMMISSION_MODELS.find((m) => m.value === partner.commissionModel)?.label ?? partner.commissionModel}
                {" · "}
                {partner.commissionRate ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Après :</span>{" "}
              <span className="font-mono font-medium text-amber-800">
                {currentModel?.label ?? model} · {rate || "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="serviceAreas">Zones desservies (séparées par virgule)</Label>
        <Input id="serviceAreas" name="serviceAreas" defaultValue={partner.serviceAreas.join(", ")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={partner.notes ?? ""} rows={2} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading
          ? "Enregistrement…"
          : commissionChanged
            ? "Enregistrer la renégociation"
            : "Mettre à jour"}
      </Button>
    </form>
  );
}
