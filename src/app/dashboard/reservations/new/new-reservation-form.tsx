"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS, isExpressEligible } from "@/lib/pricing";
import { createReservation } from "@/server/actions/reservations";
import { formatDate } from "@/lib/utils";
import { getCapacityUnit, CAPACITY_UNIT_LABEL } from "@/lib/schedule-capacity";
import Link from "next/link";
import type { TransportMode, CargoCategory } from "@prisma/client";

const MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];
const CATS = Object.keys(CARGO_CATEGORY_LABELS) as CargoCategory[];

export type SavedRecipient = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  city: string | null;
  country: string | null;
  isDefault: boolean;
};

type Schedule = {
  id: string;
  mode: TransportMode;
  origin: string;
  destination: string;
  departureDate: Date;
  arrivalDate: Date | null;
  cutoffDate: Date;
  capacity: string | null;
  capacityValue: number | null;
  reservationCount: number;
  occupancy: {
    used: number;
    capacity: number;
    remaining: number;
    isFull: boolean;
    percent: number;
  } | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function NewReservationForm({
  schedules,
  defaultScheduleId,
  defaultMode,
  nextSuggestions = {},
  savedRecipients = [],
}: {
  schedules: Schedule[];
  defaultScheduleId?: string;
  defaultMode?: TransportMode;
  nextSuggestions?: Record<string, { id: string; departureDate: Date } | null>;
  savedRecipients?: SavedRecipient[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<TransportMode>(defaultMode ?? "SEA_LCL");
  const [category, setCategory] = useState<CargoCategory>("ORDINARY");
  const [supplierTrackingNumber, setSupplierTrackingNumber] = useState("");
  const [scheduleId, setScheduleId] = useState(defaultScheduleId ?? "");
  const [estimatedWeightKg, setEstimatedWeightKg] = useState("");
  const [estimatedVolumeCBM, setEstimatedVolumeCBM] = useState("");
  const defaultRecipient = savedRecipients.find((r) => r.isDefault);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    defaultRecipient?.id ?? "",
  );
  const [recipientName, setRecipientName] = useState(defaultRecipient?.name ?? "");
  const [recipientPhone, setRecipientPhone] = useState(defaultRecipient?.phone ?? "");
  const [recipientAddress, setRecipientAddress] = useState(
    defaultRecipient
      ? [defaultRecipient.address, defaultRecipient.city, defaultRecipient.country]
          .filter(Boolean)
          .join(", ")
      : "",
  );
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  function applyRecipient(id: string) {
    setSelectedRecipientId(id);
    if (!id) {
      setRecipientName("");
      setRecipientPhone("");
      setRecipientAddress("");
      return;
    }
    const r = savedRecipients.find((x) => x.id === id);
    if (!r) return;
    setRecipientName(r.name);
    setRecipientPhone(r.phone);
    setRecipientAddress(
      [r.address, r.city, r.country].filter(Boolean).join(", "),
    );
  }

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const matchingSchedules = schedules.filter((s) => s.mode === mode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let photoBase64: string | undefined;
    if (photo) {
      try {
        photoBase64 = await fileToBase64(photo);
      } catch {
        setLoading(false);
        setError("Impossible de lire la photo.");
        return;
      }
    }

    const res = await createReservation({
      mode,
      category,
      description: description || undefined,
      supplierTrackingNumber,
      scheduleId: scheduleId || undefined,
      estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : undefined,
      estimatedVolumeCBM: estimatedVolumeCBM ? Number(estimatedVolumeCBM) : undefined,
      recipientName: recipientName || undefined,
      recipientPhone: recipientPhone || undefined,
      recipientAddress: recipientAddress || undefined,
      photoBase64,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4">
          <div className="font-semibold text-emerald-900">Réservation envoyée ✅</div>
          <div className="text-sm text-emerald-800 mt-1">
            Notre équipe vérifie votre demande et vous notifiera dès validation.
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/dashboard/reservations")}>
            Voir mes réservations
          </Button>
          <Button variant="outline" onClick={() => setSuccess(false)}>
            Faire une autre réservation
          </Button>
        </div>
      </div>
    );
  }

  // Départ pré-sélectionné depuis le calendrier
  const selectedSchedule = scheduleId
    ? schedules.find((s) => s.id === scheduleId)
    : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bannière de confirmation du départ choisi + jauge d'occupation */}
      {selectedSchedule && (() => {
        const occ = selectedSchedule.occupancy;
        const isFull = !!occ?.isFull;
        const unit = CAPACITY_UNIT_LABEL[getCapacityUnit(selectedSchedule.mode)];
        const suggestion = nextSuggestions[selectedSchedule.id];
        return (
          <div className={`rounded-md border px-4 py-3 ${isFull ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
            <p className={`text-xs font-semibold mb-1 ${isFull ? "text-destructive" : "text-primary"}`}>
              {isFull ? "⛔ Départ complet" : "✈ Départ sélectionné"}
            </p>
            <p className="text-sm font-medium">
              {TRANSPORT_MODE_LABELS[selectedSchedule.mode]} — {selectedSchedule.origin} → {selectedSchedule.destination}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Départ : {formatDate(selectedSchedule.departureDate)}
              {selectedSchedule.arrivalDate
                ? ` · Arrivée est. : ${formatDate(selectedSchedule.arrivalDate)}`
                : ""}
              {" · Cutoff : "}{formatDate(selectedSchedule.cutoffDate)}
            </p>
            <p className="text-xs mt-1">
              {occ ? (
                <span className={isFull ? "text-destructive font-medium" : occ.percent >= 80 ? "text-amber-700 font-medium" : "text-muted-foreground"}>
                  📦 {occ.used.toFixed(2)} / {occ.capacity.toFixed(2)} {unit} réservés
                  {!isFull && <> · {occ.remaining.toFixed(2)} {unit} restant{occ.remaining > 1 ? "s" : ""}</>}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  📦 {selectedSchedule.reservationCount} réservation{selectedSchedule.reservationCount > 1 ? "s" : ""} sur ce départ
                  {selectedSchedule.capacity ? ` · ${selectedSchedule.capacity}` : ""}
                </span>
              )}
            </p>
            {isFull && (
              <div className="mt-2 text-xs">
                {suggestion ? (
                  <button
                    type="button"
                    onClick={() => setScheduleId(suggestion.id)}
                    className="rounded-md border border-primary/40 bg-background px-2.5 py-1 font-medium text-primary hover:bg-primary/5"
                  >
                    → Basculer vers le prochain départ ({formatDate(suggestion.departureDate)})
                  </button>
                ) : (
                  <span className="text-muted-foreground italic">
                    Aucun autre départ n'est encore publié pour ce mode. Notre équipe vous contactera dès qu'un nouveau sera ouvert.
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mode">Mode de transport</Label>
          <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as CargoCategory)}>
            {CATS.map((c) => (
              <option key={c} value={c} disabled={mode === "AIR_EXPRESS" && !isExpressEligible(c)}>
                {CARGO_CATEGORY_LABELS[c]}
                {mode === "AIR_EXPRESS" && !isExpressEligible(c) ? " (interdit Express)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplierTrackingNumber">N° de suivi fournisseur (Chine) *</Label>
        <Input
          id="supplierTrackingNumber"
          required
          value={supplierTrackingNumber}
          onChange={(e) => setSupplierTrackingNumber(e.target.value)}
          placeholder="ex: SF1234567890CN"
        />
        <p className="text-xs text-muted-foreground">
          Ce numéro permet à notre équipe en Chine de réceptionner votre colis.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="scheduleId">Calendrier d'envoi (optionnel)</Label>
        <Select id="scheduleId" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
          <option value="">— Aucun calendrier précis —</option>
          {matchingSchedules.map((s) => {
            const occ = s.occupancy;
            const full = !!occ?.isFull;
            const unit = CAPACITY_UNIT_LABEL[getCapacityUnit(s.mode)];
            const occLabel = occ
              ? ` — ${occ.used.toFixed(2)}/${occ.capacity.toFixed(2)} ${unit}${full ? " (complet)" : ""}`
              : s.reservationCount > 0
              ? ` — ${s.reservationCount} réservation${s.reservationCount > 1 ? "s" : ""}`
              : "";
            return (
              <option key={s.id} value={s.id} disabled={full}>
                {s.origin} → {s.destination} • Départ {formatDate(s.departureDate)} (cutoff {formatDate(s.cutoffDate)}){occLabel}
              </option>
            );
          })}
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedWeightKg">Poids estimé (kg)</Label>
          <Input
            id="estimatedWeightKg"
            type="number"
            step="any"
            value={estimatedWeightKg}
            onChange={(e) => setEstimatedWeightKg(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estimatedVolumeCBM">Volume estimé (m³)</Label>
          <Input
            id="estimatedVolumeCBM"
            type="number"
            step="any"
            value={estimatedVolumeCBM}
            onChange={(e) => setEstimatedVolumeCBM(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo">Photo du colis (optionnel)</Label>
        <Input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label htmlFor="recipientPick" className="text-sm font-medium">
            Destinataire
          </Label>
          <Link
            href="/dashboard/recipients"
            target="_blank"
            className="text-xs text-primary hover:underline"
          >
            Gérer mon carnet ↗
          </Link>
        </div>
        {savedRecipients.length > 0 ? (
          <Select
            id="recipientPick"
            value={selectedRecipientId}
            onChange={(e) => applyRecipient(e.target.value)}
          >
            <option value="">— Saisir un nouveau destinataire —</option>
            {savedRecipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.phone}
                {r.city ? ` · ${r.city}` : ""}
                {r.isDefault ? " (par défaut)" : ""}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            Votre carnet est vide. Saisissez le destinataire ci-dessous — vous pourrez
            l&apos;enregistrer plus tard depuis « Mes destinataires ».
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="recipientName">Nom destinataire</Label>
          <Input
            id="recipientName"
            value={recipientName}
            onChange={(e) => {
              setRecipientName(e.target.value);
              if (selectedRecipientId) setSelectedRecipientId("");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipientPhone">Téléphone destinataire</Label>
          <Input
            id="recipientPhone"
            value={recipientPhone}
            onChange={(e) => {
              setRecipientPhone(e.target.value);
              if (selectedRecipientId) setSelectedRecipientId("");
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recipientAddress">Adresse de livraison</Label>
        <Textarea
          id="recipientAddress"
          rows={2}
          value={recipientAddress}
          onChange={(e) => {
            setRecipientAddress(e.target.value);
            if (selectedRecipientId) setSelectedRecipientId("");
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description du contenu</Label>
        <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || !!selectedSchedule?.occupancy?.isFull}
        >
          {loading ? "Envoi…" : "Envoyer la réservation"}
        </Button>
      </div>
    </form>
  );
}
