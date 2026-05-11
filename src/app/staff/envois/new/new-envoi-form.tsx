"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createEnvoi } from "@/server/actions/envois";
import { TRANSPORT_MODE_LABELS, CARRIER_LABELS } from "@/lib/pricing";
import { CalendarCheck, ChevronDown, ChevronUp } from "lucide-react";
import type { TransportMode, Carrier } from "@prisma/client";

const MODES: TransportMode[] = ["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT"];
const CARRIERS: Carrier[] = [
  "MSC", "MAERSK", "CMA_CGM", "EVERGREEN", "COSCO", "HAPAG_LLOYD", "ONE",
  "AIR_FRANCE", "ETHIOPIAN", "EMIRATES", "TURKISH", "QATAR", "KENYA_AIRWAYS", "ROYAL_AIR_MAROC",
  "OTHER",
];

type ScheduleSummary = {
  id: string;
  mode: TransportMode;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  capacity: string;
  notes: string;
};

function formatDateFR(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function NewEnvoiForm({ schedules }: { schedules: ScheduleSummary[] }) {
  const router = useRouter();

  // ── Schedule selection state ──────────────────────────────────
  const [schedulesOpen, setSchedulesOpen] = useState(schedules.length > 0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  // ── Form fields ───────────────────────────────────────────────
  const [mode, setMode] = useState<TransportMode>("SEA_LCL");
  const [origin, setOrigin] = useState("Guangzhou");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [carrier, setCarrier] = useState<Carrier | "">("");
  const [bookingNumber, setBookingNumber] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [voyageNumber, setVoyageNumber] = useState("");
  const [mawb, setMawb] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAir = mode === "AIR_EXPRESS" || mode === "AIR_NORMAL";
  const isSea = mode === "SEA_LCL" || mode === "SEA_FCL";

  function applySchedule(s: ScheduleSummary) {
    setSelectedScheduleId(s.id);
    setMode(s.mode);
    setOrigin(s.origin || "Guangzhou");
    setDestination(s.destination);
    setDepartureDate(s.departureDate);
    setArrivalDate(s.arrivalDate);
    setNotes(s.notes || "");
    setSchedulesOpen(false);
  }

  function resetSchedule() {
    setSelectedScheduleId(null);
    setMode("SEA_LCL");
    setOrigin("Guangzhou");
    setDestination("");
    setDepartureDate("");
    setArrivalDate("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createEnvoi({
      mode,
      origin,
      destination,
      departureDate: departureDate || undefined,
      arrivalDate: arrivalDate || undefined,
      carrier: carrier || undefined,
      bookingNumber: bookingNumber || undefined,
      vesselName: isSea ? vesselName || undefined : undefined,
      voyageNumber: isSea ? voyageNumber || undefined : undefined,
      mawb: isAir ? mawb || undefined : undefined,
      flightNumber: isAir ? flightNumber || undefined : undefined,
      notes: notes || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push(`/staff/envois/${res.data!.id}`);
  }

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Schedules existants ─────────────────────────────── */}
      {schedules.length > 0 && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5">
          <button
            type="button"
            onClick={() => setSchedulesOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              {selectedSchedule
                ? `Calendrier sélectionné : ${TRANSPORT_MODE_LABELS[selectedSchedule.mode]} → ${selectedSchedule.destination} (${formatDateFR(selectedSchedule.departureDate)})`
                : `${schedules.length} envoi${schedules.length > 1 ? "s" : ""} déjà planifié${schedules.length > 1 ? "s" : ""} dans le Calendrier — cliquez pour voir`}
            </span>
            {schedulesOpen ? <ChevronUp className="h-4 w-4 text-primary shrink-0" /> : <ChevronDown className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {schedulesOpen && (
            <div className="border-t border-dashed border-primary/30 divide-y divide-border">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${
                    selectedScheduleId === s.id ? "bg-primary/10" : "hover:bg-primary/5"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {TRANSPORT_MODE_LABELS[s.mode]} — {s.destination}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Départ : {formatDateFR(s.departureDate)}
                      {s.arrivalDate ? ` · Arrivée prévue : ${formatDateFR(s.arrivalDate)}` : ""}
                      {s.capacity ? ` · ${s.capacity}` : ""}
                    </div>
                    {s.notes && <div className="text-xs text-muted-foreground italic mt-0.5">{s.notes}</div>}
                  </div>
                  {selectedScheduleId === s.id ? (
                    <Button type="button" size="sm" variant="outline" onClick={resetSchedule}>
                      Désélectionner
                    </Button>
                  ) : (
                    <Button type="button" size="sm" onClick={() => applySchedule(s)}>
                      Utiliser
                    </Button>
                  )}
                </div>
              ))}
              <div className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/30">
                Aucun de ces envois ne correspond ?{" "}
                <button
                  type="button"
                  className="underline text-foreground hover:text-primary transition-colors"
                  onClick={() => { setSchedulesOpen(false); setSelectedScheduleId(null); }}
                >
                  Continuer avec un nouvel envoi vide
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Formulaire ──────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {selectedSchedule && (
          <p className="text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted/40">
            Formulaire pré-rempli depuis le Calendrier. Complétez les informations manquantes (booking, numéro de vol, etc.) puis créez l&apos;envoi.
          </p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Mode *</Label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Carrier</Label>
            <Select value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier | "")}>
              <option value="">—</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{CARRIER_LABELS[c]}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Origine</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Destination *</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="ex : Abidjan, Côte d'Ivoire"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Date de départ</Label>
            <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Date d&apos;arrivée prévue</Label>
            <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>N° de booking carrier</Label>
          <Input value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} placeholder="ex : MSCBKG12345" />
        </div>

        {isSea && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-dashed p-4">
            <div className="md:col-span-2 text-xs font-medium text-muted-foreground uppercase">Maritime</div>
            <div className="space-y-1">
              <Label>Nom du navire</Label>
              <Input value={vesselName} onChange={(e) => setVesselName(e.target.value)} placeholder="ex : MSC ARIANE" />
            </div>
            <div className="space-y-1">
              <Label>N° de voyage</Label>
              <Input value={voyageNumber} onChange={(e) => setVoyageNumber(e.target.value)} placeholder="ex : VOY-26W12" />
            </div>
          </div>
        )}

        {isAir && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-dashed p-4">
            <div className="md:col-span-2 text-xs font-medium text-muted-foreground uppercase">Aérien</div>
            <div className="space-y-1">
              <Label>MAWB (Master Air Waybill)</Label>
              <Input value={mawb} onChange={(e) => setMawb(e.target.value)} placeholder="ex : 020-12345678" />
            </div>
            <div className="space-y-1">
              <Label>N° de vol</Label>
              <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="ex : ET872" />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Création…" : "Créer l'envoi"}
        </Button>
      </form>
    </div>
  );
}
