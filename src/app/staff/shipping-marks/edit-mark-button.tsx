"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateShippingMark } from "@/server/actions/shippingMarks";
import { Pencil } from "lucide-react";

type Mark = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  notes: string | null;
};

export function EditShippingMarkButton({ mark }: { mark: Mark }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(mark.name);
  const [phone, setPhone] = useState(mark.phone);
  const [whatsapp, setWhatsapp] = useState(mark.whatsapp ?? "");
  const [notes, setNotes] = useState(mark.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(mark.name);
    setPhone(mark.phone);
    setWhatsapp(mark.whatsapp ?? "");
    setNotes(mark.notes ?? "");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await updateShippingMark({
      id: mark.id,
      name,
      phone,
      whatsapp: whatsapp.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);
    if (res.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Modifier ce shipping mark"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="w-full mt-3 rounded-md border bg-card p-3 space-y-3">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`sm-name-${mark.id}`}>Nom *</Label>
            <Input
              id={`sm-name-${mark.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`sm-phone-${mark.id}`}>Téléphone *</Label>
            <Input
              id={`sm-phone-${mark.id}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
            />
          </div>
          <div>
            <Label htmlFor={`sm-wa-${mark.id}`}>WhatsApp (optionnel)</Label>
            <Input
              id={`sm-wa-${mark.id}`}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              placeholder="Si différent du téléphone"
            />
          </div>
          <div>
            <Label htmlFor={`sm-notes-${mark.id}`}>Notes</Label>
            <Textarea
              id={`sm-notes-${mark.id}`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
