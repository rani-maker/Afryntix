"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateReservation, rejectReservation } from "@/server/actions/reservations";
import type { ReservationStatus, TransportMode, CargoCategory } from "@prisma/client";

type Props = {
  id: string;
  status: ReservationStatus;
  mode: TransportMode;
  category: CargoCategory;
  clientId: string;
  supplierTrackingNumber: string | null;
  estimatedWeightKg: number | null;
  estimatedVolumeCBM: number | null;
};

export function ReservationActions(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (props.status === "VALIDATED") {
    const params = new URLSearchParams({
      reservationId: props.id,
      clientId: props.clientId,
      mode: props.mode,
      category: props.category,
    });
    if (props.estimatedWeightKg) params.set("weightKg", String(props.estimatedWeightKg));
    if (props.estimatedVolumeCBM) params.set("volumeCBM", String(props.estimatedVolumeCBM));
    return (
      <Button asChild size="sm">
        <Link href={`/staff/shipments/new?${params.toString()}`}>Créer l'expédition</Link>
      </Button>
    );
  }

  if (props.status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (showReject) {
    return (
      <form
        className="flex flex-col gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (reason.trim().length < 3) {
            setError("Motif requis (min 3 caractères).");
            return;
          }
          start(async () => {
            const res = await rejectReservation({ id: props.id, reason: reason.trim() });
            if (!res.success) {
              setError(res.error);
              return;
            }
            setShowReject(false);
            setReason("");
            router.refresh();
          });
        }}
      >
        <div className="space-y-1 w-64">
          <Label htmlFor={`reason-${props.id}`} className="text-xs">Motif de refus</Label>
          <Textarea
            id={`reason-${props.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex: photo illisible, catégorie non acceptée…"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setShowReject(false);
              setReason("");
              setError(null);
            }}
          >
            Annuler
          </Button>
          <Button type="submit" size="sm" variant="destructive" disabled={pending}>
            {pending ? "…" : "Confirmer le refus"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await validateReservation({ id: props.id });
            if (!res.success) {
              setError(res.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "…" : "Valider"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => setShowReject(true)}
      >
        Refuser
      </Button>
      {error && <p className="text-xs text-destructive ml-2">{error}</p>}
    </div>
  );
}
