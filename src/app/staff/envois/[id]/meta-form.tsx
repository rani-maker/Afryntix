"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateEnvoiMeta } from "@/server/actions/envois";
import { CARRIER_LABELS } from "@/lib/pricing";
import type { Carrier, TransportMode } from "@prisma/client";

const CARRIERS: Carrier[] = [
  "MSC", "MAERSK", "CMA_CGM", "EVERGREEN", "COSCO", "HAPAG_LLOYD", "ONE",
  "AIR_FRANCE", "ETHIOPIAN", "EMIRATES", "TURKISH", "QATAR", "KENYA_AIRWAYS", "ROYAL_AIR_MAROC",
  "OTHER",
];

type Initial = {
  carrier: Carrier | null;
  bookingNumber: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  mawb: string | null;
  flightNumber: string | null;
  departureDate: string;
  arrivalDate: string;
  notes: string | null;
};

export function EnvoiMetaForm({
  envoiId,
  mode,
  initial,
}: {
  envoiId: string;
  mode: TransportMode;
  initial: Initial;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<Carrier | "">(initial.carrier ?? "");
  const [bookingNumber, setBookingNumber] = useState(initial.bookingNumber ?? "");
  const [vesselName, setVesselName] = useState(initial.vesselName ?? "");
  const [voyageNumber, setVoyageNumber] = useState(initial.voyageNumber ?? "");
  const [mawb, setMawb] = useState(initial.mawb ?? "");
  const [flightNumber, setFlightNumber] = useState(initial.flightNumber ?? "");
  const [departureDate, setDepartureDate] = useState(initial.departureDate);
  const [arrivalDate, setArrivalDate] = useState(initial.arrivalDate);
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAir = mode === "AIR_EXPRESS" || mode === "AIR_NORMAL";
  const isSea = mode === "SEA_LCL" || mode === "SEA_FCL";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = await updateEnvoiMeta({
      envoiId,
      carrier: carrier || undefined,
      bookingNumber,
      vesselName: isSea ? vesselName : undefined,
      voyageNumber: isSea ? voyageNumber : undefined,
      mawb: isAir ? mawb : undefined,
      flightNumber: isAir ? flightNumber : undefined,
      departureDate: departureDate || undefined,
      arrivalDate: arrivalDate || undefined,
      notes,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setInfo("Informations enregistrées.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Carrier</Label>
          <Select value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier | "")}>
            <option value="">—</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{CARRIER_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>N° de booking</Label>
          <Input value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} />
        </div>
      </div>

      {isSea && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nom du navire</Label>
            <Input value={vesselName} onChange={(e) => setVesselName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>N° de voyage</Label>
            <Input value={voyageNumber} onChange={(e) => setVoyageNumber(e.target.value)} />
          </div>
        </div>
      )}

      {isAir && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>MAWB</Label>
            <Input value={mawb} onChange={(e) => setMawb(e.target.value)} placeholder="ex : 020-12345678" />
          </div>
          <div className="space-y-1">
            <Label>N° de vol</Label>
            <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Départ</Label>
          <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Arrivée prévue</Label>
          <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={loading} variant="outline">
        {loading ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
