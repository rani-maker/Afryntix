"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCatalogOrder } from "@/server/actions/catalogues";

/**
 * Suppression définitive d'une commande catalogue, réservée à l'administrateur.
 * `compact` : icône seule, pour une ligne de la liste. `redirectTo` : page à ouvrir
 * une fois la commande supprimée (sa propre page n'existe plus).
 */
export function DeleteOrderButton({
  id,
  reference,
  shipmentCount,
  compact = false,
  redirectTo,
}: {
  id: string;
  reference: string;
  shipmentCount: number;
  compact?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const parcels =
      shipmentCount === 0
        ? ""
        : shipmentCount === 1
          ? "\n\nLe colis déjà créé pour cette commande est conservé dans les expéditions, mais il ne lui sera plus rattaché."
          : `\n\nLes ${shipmentCount} colis déjà créés pour cette commande sont conservés dans les expéditions, mais ils ne lui seront plus rattachés.`;
    const message = `Supprimer définitivement la commande ${reference} ?\n\nSes articles, ses montants et le lien de suivi du client seront effacés.${parcels}\n\nCette action est irréversible.`;
    if (!confirm(message)) return;

    setError(null);
    setLoading(true);
    let res: Awaited<ReturnType<typeof deleteCatalogOrder>>;
    try {
      res = await deleteCatalogOrder(id);
    } catch {
      res = { success: false, error: "Suppression impossible : elle est réservée à l'administrateur." };
    }
    if (!res.success) {
      setLoading(false);
      setError(res.error);
      return;
    }
    // Depuis la page de la commande, on la quitte : elle n'existe plus
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <div className={compact ? "flex flex-col items-end" : "flex flex-col items-end gap-1"}>
      {compact ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={loading}
          onClick={remove}
          aria-label={`Supprimer la commande ${reference}`}
          title="Supprimer la commande"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button type="button" size="sm" variant="destructive" disabled={loading} onClick={remove}>
          <Trash2 className="h-4 w-4" />
          {loading ? "Suppression…" : "Supprimer la commande"}
        </Button>
      )}
      {error && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
