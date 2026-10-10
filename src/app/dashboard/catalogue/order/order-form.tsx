"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCatalogOrder } from "@/server/actions/catalogues";
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_LABELS, type CatalogCategoryKey } from "@/lib/catalog-labels";

type CatalogOption = { id: string; category: CatalogCategoryKey; title: string };

type Line = {
  key: number;
  catalogId: string;
  reference: string;
  designation: string;
  page: string;
  quantity: string;
};

export function CatalogOrderForm({
  catalogs,
  defaultCatalogId,
  defaultPhone,
  defaultCity,
}: {
  catalogs: CatalogOption[];
  defaultCatalogId: string;
  defaultPhone: string;
  defaultCity: string;
}) {
  const router = useRouter();
  const newLine = (key: number, catalogId: string): Line => ({
    key,
    catalogId,
    reference: "",
    designation: "",
    page: "",
    quantity: "1",
  });
  const [lines, setLines] = useState<Line[]>([newLine(0, defaultCatalogId)]);
  const [nextKey, setNextKey] = useState(1);
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [deliveryCity, setDeliveryCity] = useState(defaultCity);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const articleCount = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, newLine(nextKey, ls[ls.length - 1]?.catalogId ?? defaultCatalogId)]);
    setNextKey((k) => k + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createCatalogOrder({
      items: lines.map((l) => ({
        catalogId: l.catalogId,
        reference: l.reference,
        designation: l.designation,
        page: l.page,
        quantity: l.quantity,
      })),
      contactPhone,
      deliveryCity,
      notes,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push("/dashboard/orders");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        {lines.map((l, idx) => (
          <div key={l.key} className="rounded-md border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Article {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button asChild type="button" size="sm" variant="ghost">
                  <a href={`/api/catalogue/${l.catalogId}/file`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Ouvrir le catalogue
                  </a>
                </Button>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Retirer l'article ${idx + 1}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-6 gap-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor={`cat-${l.key}`}>Catalogue *</Label>
                <Select
                  id={`cat-${l.key}`}
                  value={l.catalogId}
                  onChange={(e) => update(l.key, { catalogId: e.target.value })}
                >
                  {CATALOG_CATEGORIES.map((cat) => {
                    const opts = catalogs.filter((c) => c.category === cat);
                    if (opts.length === 0) return null;
                    return (
                      <optgroup key={cat} label={CATALOG_CATEGORY_LABELS[cat]}>
                        {opts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`ref-${l.key}`}>Référence *</Label>
                <Input
                  id={`ref-${l.key}`}
                  required
                  maxLength={80}
                  value={l.reference}
                  onChange={(e) => update(l.key, { reference: e.target.value })}
                  placeholder="ex: WC-2045"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`page-${l.key}`}>Page</Label>
                <Input
                  id={`page-${l.key}`}
                  maxLength={20}
                  value={l.page}
                  onChange={(e) => update(l.key, { page: e.target.value })}
                  placeholder="12"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-5">
                <Label htmlFor={`des-${l.key}`}>Désignation *</Label>
                <Input
                  id={`des-${l.key}`}
                  required
                  minLength={2}
                  maxLength={200}
                  value={l.designation}
                  onChange={(e) => update(l.key, { designation: e.target.value })}
                  placeholder="Nom de l'article, couleur, dimensions…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`qty-${l.key}`}>Quantité *</Label>
                <Input
                  id={`qty-${l.key}`}
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  step={1}
                  value={l.quantity}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={lines.length >= 100}>
          <Plus className="h-4 w-4" /> Ajouter un article
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ophone">Téléphone / WhatsApp de contact</Label>
          <Input id="ophone" maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ocity">Ville de livraison</Label>
          <Input
            id="ocity"
            maxLength={80}
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
            placeholder="Abidjan, Dakar, Lomé…"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="onotes">Message (optionnel)</Label>
        <Textarea
          id="onotes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Précisions sur les couleurs, finitions, délais souhaités…"
        />
      </div>

      <div className="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Votre bon de commande</div>
          <div className="text-2xl font-semibold tabular-nums">
            {lines.length} référence{lines.length > 1 ? "s" : ""} · {articleCount} article{articleCount > 1 ? "s" : ""}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aucun paiement à cette étape : AFRYNTIX vous envoie un devis, que vous validez ensuite.
          </p>
        </div>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Envoi…" : "Valider ma commande"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
