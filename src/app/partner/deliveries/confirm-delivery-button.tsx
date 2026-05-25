"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markLastMileDelivered } from "@/server/actions/partners";

export function ConfirmDeliveryButton({
  shipmentId,
  trackingNumber,
}: {
  shipmentId: string;
  trackingNumber: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handle() {
    if (!confirm(`Confirmer la livraison de ${trackingNumber} ?\nVotre commission sera créditée immédiatement.`)) return;
    start(async () => {
      const res = await markLastMileDelivered(shipmentId);
      if (!res.success) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={handle}>
      {pending ? "…" : "Confirmer livraison"}
    </Button>
  );
}
