"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Partner } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePartner } from "@/server/actions/partners";

export function EditPartnerForm({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const serviceAreas = String(fd.get("serviceAreas") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rate = fd.get("commissionRate");

    const res = await updatePartner({
      id: partner.id,
      companyName: String(fd.get("companyName") ?? ""),
      legalForm: String(fd.get("legalForm") ?? "") || undefined,
      taxId: String(fd.get("taxId") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? ""),
      whatsapp: String(fd.get("whatsapp") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      country: String(fd.get("country") ?? ""),
      city: String(fd.get("city") ?? ""),
      serviceAreas,
      commissionRate: rate && String(rate).trim() ? Number(rate) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg("Fiche mise à jour.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Société</Label>
          <Input id="companyName" name="companyName" defaultValue={partner.companyName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legalForm">Forme juridique</Label>
          <Input id="legalForm" name="legalForm" defaultValue={partner.legalForm ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact</Label>
          <Input id="contactName" name="contactName" defaultValue={partner.contactName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxId">N° RCCM</Label>
          <Input id="taxId" name="taxId" defaultValue={partner.taxId ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Téléphone</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={partner.contactPhone} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" defaultValue={partner.whatsapp ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={partner.email ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commissionRate">Taux / Montant</Label>
          <Input
            id="commissionRate"
            name="commissionRate"
            type="number"
            step="0.01"
            defaultValue={partner.commissionRate ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" defaultValue={partner.country} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={partner.city} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="serviceAreas">Zones desservies (séparées par virgule)</Label>
        <Input id="serviceAreas" name="serviceAreas" defaultValue={partner.serviceAreas.join(", ")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={partner.notes ?? ""} rows={2} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Mettre à jour"}
      </Button>
    </form>
  );
}
