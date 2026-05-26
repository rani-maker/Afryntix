"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { receiveReservationAsAgent } from "@/server/actions/partners";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ReceiveForm({
  reservationId,
  defaultPieces,
  declaredWeight,
  declaredVolume,
  mode,
}: {
  reservationId: string;
  defaultPieces: number;
  declaredWeight: number | null;
  declaredVolume: number | null;
  mode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  const isAir = mode.startsWith("AIR");
  const isSea = mode.startsWith("SEA");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const num = (n: string) => {
      const v = fd.get(n);
      return v && String(v).trim() ? Number(v) : undefined;
    };

    let photosBase64: string[] | undefined;
    if (photos.length > 0) {
      try {
        photosBase64 = await Promise.all(photos.slice(0, 8).map((f) => fileToDataUrl(f)));
      } catch {
        setErr("Erreur lors de la lecture des photos.");
        setLoading(false);
        return;
      }
    }

    const res = await receiveReservationAsAgent({
      reservationId,
      pieces: Number(fd.get("pieces") ?? 1),
      weightKg: Number(fd.get("weightKg")),
      lengthCm: num("lengthCm"),
      widthCm: num("widthCm"),
      heightCm: num("heightCm"),
      volumeCBM: num("volumeCBM"),
      description: String(fd.get("description") ?? "") || undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
      photosBase64,
    });

    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    router.push("/partner/warehouse");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pieces">Pièces *</Label>
          <Input id="pieces" name="pieces" type="number" min="1" defaultValue={defaultPieces} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weightKg">
            Poids réel (kg) *
            {declaredWeight != null && (
              <span className="text-xs text-muted-foreground ml-1">(déclaré : {declaredWeight} kg)</span>
            )}
          </Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
          />
        </div>
        {(isAir || isSea) && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="lengthCm">Longueur (cm)</Label>
              <Input id="lengthCm" name="lengthCm" type="number" step="0.1" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="widthCm">Largeur (cm)</Label>
              <Input id="widthCm" name="widthCm" type="number" step="0.1" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="heightCm">Hauteur (cm)</Label>
              <Input id="heightCm" name="heightCm" type="number" step="0.1" inputMode="decimal" />
            </div>
          </>
        )}
        {isSea && (
          <div className="space-y-1.5">
            <Label htmlFor="volumeCBM">
              Volume direct (CBM)
              {declaredVolume != null && (
                <span className="text-xs text-muted-foreground ml-1">(déclaré : {declaredVolume})</span>
              )}
            </Label>
            <Input id="volumeCBM" name="volumeCBM" type="number" step="0.001" inputMode="decimal" />
            <p className="text-[10px] text-muted-foreground">Saisissez ce champ OU les dimensions L×l×H</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description observée du contenu</Label>
        <Input id="description" name="description" placeholder="Ex: 3 cartons, électronique grand public" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes QC (défauts, observations)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label>Photos QC (max 8)</Label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 8))}
          className="block text-sm"
        />
        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {photos.length} photo{photos.length > 1 ? "s" : ""} sélectionnée{photos.length > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : "Réceptionner le colis"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        ✅ Le colis sera créé en statut <strong>Reçu en Chine</strong>, le client recevra une notification automatique.
      </p>
    </form>
  );
}
