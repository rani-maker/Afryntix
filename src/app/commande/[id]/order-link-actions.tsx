"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptCatalogQuoteByLink, cancelCatalogOrderByLink } from "@/server/actions/catalog-cart";

/** Réponse au devis depuis le lien signé : accepter, refuser, ou annuler la demande avant devis. */
export function OrderLinkActions({
  id,
  signature,
  reference,
  quoted,
}: {
  id: string;
  signature: string;
  reference: string;
  quoted: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: typeof acceptCatalogQuoteByLink) {
    setError(null);
    setLoading(true);
    const res = await action(id, signature).catch(() => ({
      success: false as const,
      error: "Action impossible. Vérifiez votre connexion et réessayez.",
    }));
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  function handleCancel() {
    const question = quoted ? `Refuser le devis et annuler la demande ${reference} ?` : `Annuler la demande ${reference} ?`;
    if (confirm(question)) run(cancelCatalogOrderByLink);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        {quoted && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (confirm(`Accepter le devis de la demande ${reference} ?`)) run(acceptCatalogQuoteByLink);
            }}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-mint sm:flex-1 px-6 text-[15px] font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2 disabled:opacity-60"
          >
            {loading ? "…" : "Accepter le devis"}
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={handleCancel}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-line-2 bg-surface px-6 text-sm font-medium text-ink-2 hover:border-mint-3 disabled:opacity-60"
        >
          {quoted ? "Refuser le devis" : "Annuler ma demande"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
