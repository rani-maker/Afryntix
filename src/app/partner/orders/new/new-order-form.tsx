"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createReservationByPartner } from "@/server/actions/partners";

type Schedule = { id: string; mode: string; destination: string; departureDate: string; cutoffDate: string };

const TRANSPORT_MODES = [
  { value: "AIR_EXPRESS", label: "Aérien Express" },
  { value: "AIR_NORMAL", label: "Aérien Normal" },
  { value: "SEA_LCL", label: "Maritime Groupage (LCL)" },
  { value: "SEA_FCL", label: "Maritime Conteneur (FCL)" },
  { value: "VEHICLE", label: "Transport Véhicule" },
  { value: "BTP_EQUIPMENT", label: "Engin BTP" },
  { value: "STORAGE", label: "Entreposage" },
];

const CATEGORIES = [
  { value: "ORDINARY", label: "Colis ordinaire" },
  { value: "BATTERY", label: "Avec batterie" },
  { value: "LIQUID", label: "Liquide" },
  { value: "COSMETIC", label: "Cosmétique" },
  { value: "POWDER", label: "Poudre" },
  { value: "PHONE", label: "Téléphone" },
  { value: "COMPUTER", label: "Ordinateur" },
  { value: "VEHICLE", label: "Véhicule" },
  { value: "BTP", label: "Engin BTP" },
  { value: "OTHER", label: "Autre" },
];

export function NewOrderForm({ schedules }: { schedules: Schedule[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState("AIR_NORMAL");

  const filteredSchedules = schedules.filter((s) => s.mode === mode);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const num = (n: string) => {
      const v = fd.get(n);
      return v && String(v).trim() ? Number(v) : undefined;
    };
    const str = (n: string) => {
      const v = fd.get(n);
      return v ? String(v).trim() : "";
    };

    const res = await createReservationByPartner({
      mode: mode as "AIR_EXPRESS" | "AIR_NORMAL" | "SEA_LCL" | "SEA_FCL" | "VEHICLE" | "BTP_EQUIPMENT" | "STORAGE",
      category: str("category") as "ORDINARY" | "BATTERY" | "LIQUID" | "COSMETIC" | "POWDER" | "PHONE" | "COMPUTER" | "VEHICLE" | "BTP" | "OTHER",
      supplierTrackingNumber: str("supplierTrackingNumber"),
      description: str("description") || undefined,
      estimatedWeightKg: num("estimatedWeightKg"),
      estimatedVolumeCBM: num("estimatedVolumeCBM"),
      scheduleId: str("scheduleId") || undefined,
      recipientName: str("recipientName"),
      recipientPhone: str("recipientPhone"),
      recipientAddress: str("recipientAddress") || undefined,
      clientEmail: str("clientEmail") || undefined,
      clientName: str("clientName") || undefined,
      clientPhone: str("clientPhone") || undefined,
    });

    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    router.push("/partner/orders");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Section client */}
      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Client final (votre client)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Nom du client *</Label>
            <Input id="clientName" name="clientName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientPhone">Téléphone *</Label>
            <Input id="clientPhone" name="clientPhone" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientEmail">Email (optionnel)</Label>
            <Input id="clientEmail" name="clientEmail" type="email" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Si le client a déjà un compte AFRYNTIX, saisissez son email — la commande lui sera rattachée.
        </p>
      </div>

      {/* Section colis */}
      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Détails du colis</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode de transport *</Label>
            <select
              id="mode"
              name="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              required
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
              name="category"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue="ORDINARY"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplierTrackingNumber">N° tracking fournisseur Chine *</Label>
            <Input id="supplierTrackingNumber" name="supplierTrackingNumber" required placeholder="Ex: SF1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduleId">Calendrier (optionnel)</Label>
            <select
              id="scheduleId"
              name="scheduleId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
            >
              <option value="">— Aucun choix —</option>
              {filteredSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.destination} · départ {new Date(s.departureDate).toLocaleDateString("fr-FR")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimatedWeightKg">Poids estimé (kg)</Label>
            <Input id="estimatedWeightKg" name="estimatedWeightKg" type="number" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimatedVolumeCBM">Volume estimé (CBM)</Label>
            <Input id="estimatedVolumeCBM" name="estimatedVolumeCBM" type="number" step="0.001" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description du contenu</Label>
          <Textarea id="description" name="description" rows={2} placeholder="Ex: 3 cartons de pièces auto" />
        </div>
      </div>

      {/* Section destinataire */}
      <div className="space-y-3">
        <div className="text-sm font-medium border-b pb-1">Destinataire en Afrique</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipientName">Nom du destinataire *</Label>
            <Input id="recipientName" name="recipientName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipientPhone">Téléphone *</Label>
            <Input id="recipientPhone" name="recipientPhone" required />
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
          {loading ? "Envoi…" : "Soumettre la commande"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        La commande passe en statut « En attente » jusqu'à validation par l'équipe AFRYNTIX. Vous serez notifié à chaque étape.
      </p>
    </form>
  );
}
