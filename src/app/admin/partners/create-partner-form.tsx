"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPartner, type CreatePartnerInput } from "@/server/actions/partners";

const TYPE_OPTIONS: Array<{ value: CreatePartnerInput["type"]; label: string; help: string }> = [
  { value: "APPORTEUR", label: "Apporteur d'affaires", help: "Apporte des clients, commission % sur CA encaissé" },
  { value: "REVENDEUR", label: "Revendeur (sous-agent)", help: "Revend votre service dans une autre ville (tarif gros)" },
  { value: "TRANSPORTEUR_RELAIS", label: "Transporteur relais", help: "Livre les colis last-mile en Afrique" },
  { value: "AGENT_CHINE", label: "Agent Chine", help: "Réception, QC, entrepôt en Chine" },
  { value: "CONFRERE_FORWARDER", label: "Confrère forwarder", help: "Autre transitaire qui charge sur vos conteneurs" },
];

const COMMISSION_OPTIONS: Array<{ value: CreatePartnerInput["commissionModel"]; label: string; unit: string }> = [
  { value: "PERCENT_OF_REVENUE", label: "% sur CA encaissé", unit: "%" },
  { value: "PERCENT_OF_MARGIN", label: "% sur marge brute (≈30%)", unit: "%" },
  { value: "FIXED_PER_SHIPMENT", label: "Forfait par colis", unit: "FCFA / colis" },
  { value: "FIXED_PER_KG", label: "Forfait au kg", unit: "FCFA / kg" },
  { value: "FIXED_PER_CBM", label: "Forfait au CBM", unit: "FCFA / CBM" },
  { value: "WHOLESALE_TARIFF", label: "Tarif gros (pas de commission auto)", unit: "" },
];

export function CreatePartnerForm() {
  const router = useRouter();
  const [type, setType] = useState<CreatePartnerInput["type"]>("APPORTEUR");
  const [commissionModel, setCommissionModel] =
    useState<CreatePartnerInput["commissionModel"]>("PERCENT_OF_REVENUE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; referralCode: string } | null>(null);

  const selectedCommission = COMMISSION_OPTIONS.find((c) => c.value === commissionModel)!;
  const showCommissionRate = commissionModel !== "WHOLESALE_TARIFF";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const serviceAreasRaw = String(formData.get("serviceAreas") ?? "");
    const serviceAreas = serviceAreasRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const commissionRateRaw = formData.get("commissionRate");
    const commissionRate = commissionRateRaw && String(commissionRateRaw).trim()
      ? Number(commissionRateRaw)
      : undefined;

    const input: CreatePartnerInput = {
      type,
      companyName: String(formData.get("companyName") ?? "").trim(),
      legalForm: String(formData.get("legalForm") ?? "").trim() || undefined,
      taxId: String(formData.get("taxId") ?? "").trim() || undefined,
      contactName: String(formData.get("contactName") ?? "").trim(),
      contactPhone: String(formData.get("contactPhone") ?? "").trim(),
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      country: String(formData.get("country") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      serviceAreas,
      originSide: (String(formData.get("originSide") ?? "") || undefined) as "CHINA" | "AFRICA" | undefined,
      commissionModel,
      commissionRate,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    };

    const res = await createPartner(input);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess({ code: res.data!.code, referralCode: res.data!.referralCode });
    (e.target as HTMLFormElement).reset();
    setType("APPORTEUR");
    setCommissionModel("PERCENT_OF_REVENUE");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type de partenaire */}
      <div className="space-y-2">
        <Label>Type de partenaire</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`text-left p-3 rounded-md border text-xs transition ${
                type === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-input hover:bg-accent"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-muted-foreground mt-0.5">{opt.help}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Identité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Société / Nom commercial *</Label>
          <Input id="companyName" name="companyName" required placeholder="Ex: Diallo Logistics SARL" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legalForm">Forme juridique</Label>
          <Input id="legalForm" name="legalForm" placeholder="SARL, EI, particulier…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Personne de contact *</Label>
          <Input id="contactName" name="contactName" required placeholder="Nom complet" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxId">N° RCCM / Contribuable</Label>
          <Input id="taxId" name="taxId" placeholder="Optionnel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Téléphone *</Label>
          <Input id="contactPhone" name="contactPhone" required placeholder="+225..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" placeholder="Si différent du téléphone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="optionnel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="originSide">Localisation opérationnelle</Label>
          <select
            id="originSide"
            name="originSide"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="">— Non spécifié —</option>
            <option value="AFRICA">Afrique (destination)</option>
            <option value="CHINA">Chine (origine)</option>
          </select>
        </div>
      </div>

      {/* Adresse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays *</Label>
          <Input id="country" name="country" required defaultValue="Côte d'Ivoire" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville *</Label>
          <Input id="city" name="city" required placeholder="Ex: Bouaké" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serviceAreas">Zones desservies</Label>
          <Input id="serviceAreas" name="serviceAreas" placeholder="Bouaké, Yamoussoukro, Korhogo" />
          <p className="text-xs text-muted-foreground">Séparées par des virgules</p>
        </div>
      </div>

      {/* Économie */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-4">
        <div className="text-sm font-medium">Modèle de rémunération</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="commissionModel">Modèle</Label>
            <select
              id="commissionModel"
              name="commissionModel"
              value={commissionModel}
              onChange={(e) => setCommissionModel(e.target.value as CreatePartnerInput["commissionModel"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {COMMISSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {showCommissionRate && (
            <div className="space-y-1.5">
              <Label htmlFor="commissionRate">
                {selectedCommission.value.startsWith("PERCENT") ? "Taux (%)" : "Montant"} *
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="commissionRate"
                  name="commissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  required={showCommissionRate}
                  placeholder={selectedCommission.value.startsWith("PERCENT") ? "Ex: 5" : "Ex: 2000"}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{selectedCommission.unit}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes internes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Conditions négociées, recommandé par…" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Le partenaire est créé avec le statut <strong>En attente KYC</strong>. Téléversez ses pièces puis activez-le.
        </p>
        <Button type="submit" disabled={loading}>
          {loading ? "Création…" : "Créer le partenaire"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 text-sm">
          <div className="font-medium text-emerald-900">Partenaire créé avec succès</div>
          <div className="text-emerald-800 mt-1">
            Code interne : <code className="font-mono">{success.code}</code>
          </div>
          <div className="text-emerald-800">
            Code parrain à communiquer : <code className="font-mono font-bold">{success.referralCode}</code>
          </div>
          <p className="text-xs text-emerald-700 mt-2">
            Communiquez ce code parrain par WhatsApp. Les clients qui s'inscriront avec ce code seront automatiquement
            attribués à ce partenaire.
          </p>
        </div>
      )}
    </form>
  );
}
