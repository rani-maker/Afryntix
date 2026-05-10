"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAddress } from "@/server/actions/addresses";

export function AddressForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createAddress({
      type: fd.get("type"),
      label: fd.get("label"),
      contactName: fd.get("contactName") || undefined,
      phone: fd.get("phone") || undefined,
      whatsapp: fd.get("whatsapp") || undefined,
      email: fd.get("email") || undefined,
      line1: fd.get("line1"),
      line2: fd.get("line2") || undefined,
      city: fd.get("city"),
      country: fd.get("country"),
      postalCode: fd.get("postalCode") || undefined,
      notes: fd.get("notes") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Adresse enregistrée.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" required>
            <option value="AIR_WAREHOUSE">Entrepôt aérien (Chine)</option>
            <option value="SEA_WAREHOUSE">Entrepôt maritime (Chine)</option>
            <option value="RECEPTION">Réception (Afrique)</option>
            <option value="OFFICE">Bureau</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label">Libellé</Label>
          <Input id="label" name="label" required placeholder="ex: Entrepôt Guangzhou Aérien" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="line1">Adresse ligne 1</Label>
        <Input id="line1" name="line1" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="line2">Adresse ligne 2</Label>
        <Input id="line2" name="line2" />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postalCode">Code postal</Label>
          <Input id="postalCode" name="postalCode" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact</Label>
          <Input id="contactName" name="contactName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer l'adresse"}
      </Button>
    </form>
  );
}
