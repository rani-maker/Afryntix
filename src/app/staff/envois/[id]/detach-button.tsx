"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { detachShipmentFromEnvoi } from "@/server/actions/envois";

export function DetachShipmentButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("Détacher ce colis de l'envoi ?")) return;
    setLoading(true);
    const res = await detachShipmentFromEnvoi({ shipmentId });
    setLoading(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleClick} disabled={loading}>
      Détacher
    </Button>
  );
}
