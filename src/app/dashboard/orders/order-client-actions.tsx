"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptCatalogQuote, cancelCatalogOrder } from "@/server/actions/catalogues";

/** Actions du client sur sa commande : accepter / refuser le devis, ou annuler avant devis. */
export function OrderClientActions({
  id,
  reference,
  quoted,
}: {
  id: string;
  reference: string;
  quoted: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: (id: string) => Promise<{ success: true } | { success: false; error: string }>) {
    setLoading(true);
    const res = await action(id);
    setLoading(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  function handleCancel() {
    const question = quoted
      ? `Refuser le devis et annuler la commande ${reference} ?`
      : `Annuler la commande ${reference} ?`;
    if (confirm(question)) run(cancelCatalogOrder);
  }

  function handleAccept() {
    if (confirm(`Accepter le devis de la commande ${reference} ?`)) run(acceptCatalogQuote);
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={handleCancel} disabled={loading}>
        {quoted ? "Refuser le devis" : "Annuler la commande"}
      </Button>
      {quoted && (
        <Button size="sm" onClick={handleAccept} disabled={loading}>
          {loading ? "…" : "Accepter le devis"}
        </Button>
      )}
    </div>
  );
}
