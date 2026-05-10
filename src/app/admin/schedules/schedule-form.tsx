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

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as Array<keyof typeof TRANSPORT_MODE_LABELS>;

export function ScheduleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          <Select id="mode" name="mode" required>
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacité (optionnel)</Label>
          <Input id="capacity" name="capacity" placeholder="ex: 1 conteneur 40HQ" />
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
