"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { assignLastMilePartner, unassignLastMilePartner, markLastMileDelivered } from "@/server/actions/partners";
import { formatDateTime, formatXOF } from "@/lib/utils";

type Transporteur = {
  id: string;
  companyName: string;
  contactName: string;
  city: string;
};

export function LastMileSection({
  shipmentId,
  currentPartner,
  currentAmount,
  assignedAt,
  deliveredAt,
  settled,
  transporteurs,
}: {
  shipmentId: string;
  currentPartner: { id: string; code: string; companyName: string; contactName: string; contactPhone: string } | null;
  currentAmount: number | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
  settled: boolean;
  transporteurs: Transporteur[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [partnerId, setPartnerId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function clear() {
    setErr(null);
    setMsg(null);
  }

  function handleAssign() {
    clear();
    if (!partnerId) {
      setErr("Sélectionnez un transporteur.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErr("Montant invalide.");
      return;
    }
    start(async () => {
      const res = await assignLastMilePartner({ shipmentId, partnerId, amount: amt });
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setMsg("Livraison assignée.");
      router.refresh();
    });
  }

  function handleUnassign() {
    if (!confirm("Annuler l'assignation ?")) return;
    clear();
    start(async () => {
      const res = await unassignLastMilePartner(shipmentId);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleMarkDelivered() {
    if (!confirm("Confirmer la livraison ? La commission sera créditée au transporteur.")) return;
    clear();
    start(async () => {
      const res = await markLastMileDelivered(shipmentId);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setMsg("Livraison confirmée, commission créditée.");
      router.refresh();
    });
  }

  // Cas 1 : assigné + livré (soldé)
  if (currentPartner && settled) {
    return (
      <div className="space-y-2 text-sm">
        <Badge variant="success">Livré par le transporteur</Badge>
        <div>
          <Link href={`/admin/partners/${currentPartner.id}`} className="font-medium hover:underline">
            {currentPartner.companyName}
          </Link>
          <span className="text-muted-foreground"> · {currentPartner.contactName} · {currentPartner.contactPhone}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Rémunération : {formatXOF(currentAmount ?? 0)} · Livré le {deliveredAt ? formatDateTime(deliveredAt) : "—"}
        </div>
      </div>
    );
  }

  // Cas 2 : assigné mais pas encore livré
  if (currentPartner && !settled) {
    return (
      <div className="space-y-3 text-sm">
        <Badge variant="warning">En cours de livraison</Badge>
        <div>
          <Link href={`/admin/partners/${currentPartner.id}`} className="font-medium hover:underline">
            {currentPartner.companyName}
          </Link>
          <span className="text-muted-foreground"> · {currentPartner.contactName} · {currentPartner.contactPhone}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Rémunération convenue : {formatXOF(currentAmount ?? 0)} · Assigné le {assignedAt ? formatDateTime(assignedAt) : "—"}
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" disabled={pending} onClick={handleMarkDelivered}>
            {pending ? "…" : "Confirmer la livraison"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={handleUnassign}>
            Désassigner
          </Button>
        </div>
        {err && <p className="text-destructive">{err}</p>}
        {msg && <p className="text-emerald-700">{msg}</p>}
      </div>
    );
  }

  // Cas 3 : non assigné
  if (transporteurs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun transporteur relais actif. Créez-en un dans <Link href="/admin/partners" className="underline">Partenaires</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Assignez ce colis à un partenaire transporteur pour la livraison locale. La rémunération convenue lui sera créditée à la confirmation de livraison.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="partnerId">Transporteur</Label>
          <select
            id="partnerId"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Choisir —</option>
            {transporteurs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.companyName} · {t.city} · {t.contactName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lmAmount">Rémunération (FCFA)</Label>
          <Input
            id="lmAmount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
          />
        </div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button size="sm" disabled={pending} onClick={handleAssign}>
        {pending ? "Assignation…" : "Assigner la livraison"}
      </Button>
    </div>
  );
}
