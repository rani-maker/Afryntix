"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteShipment } from "@/server/actions/shipments";

export function DeleteShipmentButton({ id }: { id: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStep("loading");
    setError(null);
    const res = await deleteShipment(id);
    if (!res.success) {
      setError(res.error);
      setStep("idle");
    }
  }

  if (step === "confirm") {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={handleConfirm}
          className="rounded px-2 py-0.5 text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
        >
          Confirmer
        </button>
        <button
          onClick={() => setStep("idle")}
          className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        onClick={() => setStep("confirm")}
        disabled={step === "loading"}
        title="Supprimer ce colis"
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-destructive max-w-[120px] text-right">{error}</span>}
    </span>
  );
}
