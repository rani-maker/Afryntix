"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createRecipient,
  updateRecipient,
  deleteRecipient,
  setDefaultRecipient,
} from "@/server/actions/recipients";

type Recipient = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  isDefault: boolean;
};

const EMPTY = {
  name: "",
  phone: "",
  whatsapp: "",
  address: "",
  city: "",
  country: "",
  notes: "",
  isDefault: false,
};

export function RecipientsList({ initial }: { initial: Recipient[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function startEdit(r: Recipient) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      phone: r.phone,
      whatsapp: r.whatsapp ?? "",
      address: r.address ?? "",
      city: r.city ?? "",
      country: r.country ?? "",
      notes: r.notes ?? "",
      isDefault: r.isDefault,
    });
    setShowForm(true);
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(initial.length === 0);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = editingId
      ? await updateRecipient({ id: editingId, ...form })
      : await createRecipient(form);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    cancel();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer ce destinataire de votre carnet ?")) return;
    startTransition(async () => {
      const res = await deleteRecipient(id);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  async function onMakeDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultRecipient(id);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {initial.length} destinataire{initial.length > 1 ? "s" : ""} enregistré
          {initial.length > 1 ? "s" : ""}
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            + Ajouter un destinataire
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Modifier le destinataire" : "Nouveau destinataire"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse de livraison</Label>
                <Textarea
                  id="address"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Destinataire par défaut (pré-sélectionné dans les nouvelles réservations)
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={cancel} disabled={loading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Enregistrement…" : editingId ? "Mettre à jour" : "Ajouter"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {initial.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun destinataire enregistré. Ajoutez-en un pour aller plus vite à la prochaine
            réservation.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {initial.map((r) => (
          <Card key={r.id} className={r.isDefault ? "border-primary/40" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <div className="text-sm text-muted-foreground">{r.phone}</div>
                </div>
                {r.isDefault && (
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    Par défaut
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {r.whatsapp && (
                <div className="text-muted-foreground">WhatsApp : {r.whatsapp}</div>
              )}
              {(r.city || r.country) && (
                <div>{[r.city, r.country].filter(Boolean).join(", ")}</div>
              )}
              {r.address && <div className="text-muted-foreground">{r.address}</div>}
              {r.notes && (
                <div className="text-xs text-muted-foreground italic">{r.notes}</div>
              )}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                  Modifier
                </Button>
                {!r.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => onMakeDefault(r.id)}>
                    Définir par défaut
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(r.id)}
                >
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
