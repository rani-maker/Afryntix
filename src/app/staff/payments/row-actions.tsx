"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeBillPayment } from "@/server/actions/payments";

export function CompletePaymentButton({
  id,
  recipientName,
}: {
  id: string;
  recipientName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pickupName, setPickupName] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [pickupId, setPickupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setPickupName("");
    setPickupPhone("");
    setPickupId("");
    setError(null);
  }

  function submit(useBeneficiary: boolean) {
    setError(null);
    const payload = useBeneficiary
      ? { id, pickupPersonName: recipientName }
      : {
          id,
          pickupPersonName: pickupName.trim(),
          pickupPersonPhone: pickupPhone.trim(),
          pickupPersonId: pickupId.trim(),
        };

    if (!useBeneficiary && !payload.pickupPersonName) {
      setError("Le nom de la personne présente est requis.");
      return;
    }

    start(async () => {
      const res = await completeBillPayment(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Marquer effectué
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Confirmer le retrait</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bénéficiaire prévu&nbsp;: <span className="font-medium text-foreground">{recipientName}</span>
              </p>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Si une autre personne récupère le montant à la place du bénéficiaire,
                renseignez ses informations ci-dessous (sinon laissez vide et cliquez «&nbsp;C'est le bénéficiaire&nbsp;»).
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="pickup-name">Nom complet de la personne présente</Label>
                <Input
                  id="pickup-name"
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                  placeholder="ex: Aïcha Konaté"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pickup-phone">Téléphone</Label>
                <Input
                  id="pickup-phone"
                  type="tel"
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value)}
                  placeholder="ex: +225 07 00 00 00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pickup-id">Pièce d'identité (optionnel)</Label>
                <Input
                  id="pickup-id"
                  value={pickupId}
                  onChange={(e) => setPickupId(e.target.value)}
                  placeholder="N° CNI / passeport"
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={close}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(true)}
                disabled={pending}
              >
                C'est le bénéficiaire
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => submit(false)}
                disabled={pending}
              >
                {pending ? "…" : "Valider le retrait"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
