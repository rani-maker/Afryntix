"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { createSchedule } from "@/server/actions/schedules";
import { getCapacityUnit, CAPACITY_UNIT_LABEL } from "@/lib/schedule-capacity";
import type { TransportMode } from "@prisma/client";

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];

// Aide à la saisie : valeur indicative selon le mode courant.
const CAPACITY_HINT: Record<TransportMode, string> = {
  SEA_LCL: "ex: 30 (m³ disponibles dans le groupage)",
  SEA_FCL: "ex: 68 (m³ utiles d'un 40HQ)",
  AIR_EXPRESS: "ex: 1500 (kg disponibles dans l'avion)",
  AIR_NORMAL: "ex: 3000 (kg disponibles)",
  VEHICLE: "ex: 4 (véhicules max)",
  BTP_EQUIPMENT: "ex: 2 (engins max)",
  STORAGE: "ex: 50 (m³ de stockage)",
};

export function ScheduleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // On suit le mode pour adapter l'étiquette et le placeholder du champ capacité.
  const [mode, setMode] = useState<TransportMode>("SEA_LCL");
  const capacityUnit = getCapacityUnit(mode);
  const capacityUnitLabel = CAPACITY_UNIT_LABEL[capacityUnit];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createSchedule({
      mode: fd.get("mode"),
      departureDate: fd.get("departureDate"),
      arrivalDate: fd.get("arrivalDate") || undefined,
      cutoffDate: fd.get("cutoffDate"),
      origin: fd.get("origin") || "Guangzhou",
      destination: fd.get("destination"),
      capacity: fd.get("capacity") || undefined,
      capacityValue: fd.get("capacityValue") || undefined,
      notes: fd.get("notes") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Calendrier publié.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mode">Mode de transport</Label>
          <Select
            id="mode"
            name="mode"
            required
            value={mode}
            onChange={(e) => setMode(e.target.value as TransportMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacité — libellé (optionnel)</Label>
          <Input id="capacity" name="capacity" placeholder="ex: 1 conteneur 40HQ" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="capacityValue">
            Capacité numérique — en {capacityUnitLabel} (optionnel)
          </Label>
          <Input
            id="capacityValue"
            name="capacityValue"
            type="number"
            min="0"
            step={capacityUnit === "UNIT" ? "1" : "0.01"}
            placeholder={CAPACITY_HINT[mode]}
          />
          <p className="text-xs text-muted-foreground">
            {capacityUnit === "CBM" &&
              "Volume total exploitable en CBM. Pour un 40HQ, saisissez environ 68."}
            {capacityUnit === "KG" &&
              "Poids total acceptable en kg pour ce vol."}
            {capacityUnit === "UNIT" &&
              "Nombre maximum d'unités embarquées (véhicules, engins…)."}
            {" "}
            Les réservations consomment de la capacité selon leurs estimations
            (volume pour le maritime, poids pour l'aérien). Au-delà du plafond,
            les nouvelles réservations sont refusées et le prochain départ est suggéré.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cutoffDate">Date limite réservation</Label>
          <Input id="cutoffDate" name="cutoffDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="departureDate">Date de départ</Label>
          <Input id="departureDate" name="departureDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="arrivalDate">Date d'arrivée (optionnel)</Label>
          <Input id="arrivalDate" name="arrivalDate" type="date" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="origin">Origine</Label>
          <Input id="origin" name="origin" defaultValue="Guangzhou" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destination">Destination</Label>
          <Input id="destination" name="destination" placeholder="ex: Abidjan" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Information complémentaire" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Publication…" : "Publier le calendrier"}
      </Button>
    </form>
  );
}
