"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertSupplier, deleteSupplier } from "@/server/actions/suppliers";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Supplier } from "@prisma/client";

/**
 * Sécurité : empêche les URL `javascript:`, `data:`, `vbscript:` etc.
 * React n'échappe PAS ces schémas dans un attribut href.
 */
function safeHttpUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    // URL invalide
  }
  return undefined;
}

export function SuppliersList({ initial }: { initial: Supplier[] }) {
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!creating && !editing && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        )}
      </div>

      {(creating || editing) && (
        <SupplierForm
          initial={editing ?? undefined}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun fournisseur. Ajoutez vos contacts Chine pour les retrouver rapidement lors de vos commandes.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {initial.map((s) => (
            <SupplierItem key={s.id} supplier={s} onEdit={() => setEditing(s)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SupplierItem({ supplier, onEdit }: { supplier: Supplier; onEdit: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function handleDelete() {
    if (!confirm(`Supprimer ${supplier.name} ?`)) return;
    setLoading(true);
    const res = await deleteSupplier(supplier.id);
    setLoading(false);
    if (!res.success) { alert(res.error); return; }
    router.refresh();
  }
  return (
    <li className="p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">
          {supplier.name}
          {supplier.category && (
            <span className="ml-2 text-xs text-muted-foreground">· {supplier.category}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-1">
          {supplier.contactPerson && <span>👤 {supplier.contactPerson}</span>}
          {supplier.phone && <span>📞 {supplier.phone}</span>}
          {supplier.whatsapp && <span>💬 {supplier.whatsapp}</span>}
          {supplier.wechat && <span>WeChat: {supplier.wechat}</span>}
          {supplier.email && <span>✉ {supplier.email}</span>}
          {supplier.city && <span>📍 {supplier.city}</span>}
        </div>
        {supplier.address && <div className="text-xs text-muted-foreground mt-0.5">{supplier.address}</div>}
        {safeHttpUrl(supplier.alibabaUrl) && (
          <a
            href={safeHttpUrl(supplier.alibabaUrl)!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Page Alibaba / 1688
          </a>
        )}
        {supplier.notes && <p className="text-xs italic text-muted-foreground mt-1">{supplier.notes}</p>}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={loading}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function SupplierForm({ initial, onDone }: { initial?: Supplier; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  const [wechat, setWechat] = useState(initial?.wechat ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [alibabaUrl, setAlibabaUrl] = useState(initial?.alibabaUrl ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await upsertSupplier({
      id: initial?.id,
      name, contactPerson, phone, whatsapp, wechat, email,
      city, address, alibabaUrl, category, notes,
    });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sname">Raison sociale *</Label>
          <Input id="sname" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scat">Catégorie</Label>
          <Input id="scat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex: Électronique" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scontact">Contact</Label>
          <Input id="scontact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sphone">Téléphone</Label>
          <Input id="sphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="swa">WhatsApp</Label>
          <Input id="swa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="swc">WeChat</Label>
          <Input id="swc" value={wechat} onChange={(e) => setWechat(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="semail">Email</Label>
          <Input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scity">Ville</Label>
          <Input id="scity" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Guangzhou, Yiwu…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="saddr">Adresse complète</Label>
        <Input id="saddr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salib">URL Alibaba / 1688</Label>
        <Input id="salib" type="url" value={alibabaUrl} onChange={(e) => setAlibabaUrl(e.target.value)} maxLength={300} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="snotes">Notes</Label>
        <Textarea id="snotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Annuler</Button>
        <Button type="submit" size="sm" disabled={loading || !name}>
          {loading ? "…" : initial ? "Mettre à jour" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
