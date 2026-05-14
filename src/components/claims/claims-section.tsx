"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClaim, updateClaim } from "@/server/actions/claims";
import {
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_TONE,
} from "@/lib/claims-labels";
import { formatDateTime, formatXOF } from "@/lib/utils";
import type { ClaimType, ClaimStatus } from "@prisma/client";
import { Plus } from "lucide-react";

export type ClaimRow = {
  id: string;
  reference: string;
  type: ClaimType;
  status: ClaimStatus;
  title: string;
  description: string;
  amountClaimed: number | null;
  amountGranted: number | null;
  resolution: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  openedBy: { name: string } | null;
  resolvedBy: { name: string } | null;
};

const CLAIM_TYPES: ClaimType[] = ["LOSS", "DAMAGE", "DELAY", "MISSING_ITEM", "WRONG_ITEM", "OTHER"];
const CLAIM_STATUSES: ClaimStatus[] = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", "CANCELLED"];

export function ClaimsSection({
  shipmentId,
  claims,
  isStaff,
  canCreate,
}: {
  shipmentId: string;
  claims: ClaimRow[];
  isStaff: boolean;
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {claims.length === 0
            ? "Aucune réclamation."
            : `${claims.length} réclamation${claims.length > 1 ? "s" : ""}`}
        </p>
        {canCreate && (
          <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
            {open ? "Annuler" : (<><Plus className="h-4 w-4" /> Ouvrir</>)}
          </Button>
        )}
      </div>

      {open && canCreate && (
        <CreateClaimForm shipmentId={shipmentId} onDone={() => setOpen(false)} />
      )}

      {claims.length > 0 && (
        <ul className="space-y-3">
          {claims.map((c) => (
            <ClaimItem key={c.id} claim={c} isStaff={isStaff} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClaimItem({ claim, isStaff }: { claim: ClaimRow; isStaff: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ClaimStatus>(claim.status);
  const [granted, setGranted] = useState(claim.amountGranted != null ? String(claim.amountGranted) : "");
  const [resolution, setResolution] = useState(claim.resolution ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    setError(null);
    setLoading(true);
    const res = await updateClaim({
      id: claim.id,
      status,
      amountGranted: granted ? Number(granted) : undefined,
      resolution: resolution || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="rounded-md border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={CLAIM_STATUS_TONE[claim.status]}>{CLAIM_STATUS_LABELS[claim.status]}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{claim.reference}</span>
            <span className="text-xs text-muted-foreground">· {CLAIM_TYPE_LABELS[claim.type]}</span>
          </div>
          <p className="font-medium mt-1">{claim.title}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{claim.description}</p>
          <div className="text-xs text-muted-foreground mt-1">
            Ouverte {formatDateTime(claim.createdAt)}
            {claim.openedBy && <> par {claim.openedBy.name}</>}
            {claim.amountClaimed != null && <> · demandé : {formatXOF(claim.amountClaimed)}</>}
          </div>
          {claim.amountGranted != null && (
            <div className="text-xs">
              <span className="text-muted-foreground">Accordé : </span>
              <span className="font-medium">{formatXOF(claim.amountGranted)}</span>
            </div>
          )}
          {claim.resolution && (
            <p className="text-xs italic mt-1 text-muted-foreground whitespace-pre-line">
              Résolution : {claim.resolution}
            </p>
          )}
          {claim.resolvedAt && claim.resolvedBy && (
            <div className="text-xs text-muted-foreground">
              Clôturée le {formatDateTime(claim.resolvedAt)} par {claim.resolvedBy.name}
            </div>
          )}
        </div>
        {isStaff && !editing && claim.status !== "RESOLVED" && claim.status !== "REJECTED" && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Traiter
          </Button>
        )}
      </div>

      {isStaff && editing && (
        <div className="rounded-md bg-muted/40 p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`s-${claim.id}`}>Statut</Label>
              <Select id={`s-${claim.id}`} value={status} onChange={(e) => setStatus(e.target.value as ClaimStatus)}>
                {CLAIM_STATUSES.map((s) => (
                  <option key={s} value={s}>{CLAIM_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`g-${claim.id}`}>Indemnité accordée (FCFA)</Label>
              <Input
                id={`g-${claim.id}`}
                type="number"
                min="0"
                step="any"
                value={granted}
                onChange={(e) => setGranted(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`r-${claim.id}`}>Résolution / note interne</Label>
            <Textarea
              id={`r-${claim.id}`}
              rows={2}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={5000}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
            <Button size="sm" onClick={handleUpdate} disabled={loading}>
              {loading ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateClaimForm({ shipmentId, onDone }: { shipmentId: string; onDone: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<ClaimType>("DAMAGE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createClaim({
      shipmentId,
      type,
      title: title.trim(),
      description: description.trim(),
      amountClaimed: amount ? Number(amount) : undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setTitle(""); setDescription(""); setAmount("");
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="claim-type">Type</Label>
          <Select id="claim-type" value={type} onChange={(e) => setType(e.target.value as ClaimType)}>
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>{CLAIM_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-amount">Indemnité demandée (FCFA, optionnel)</Label>
          <Input
            id="claim-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claim-title">Titre court *</Label>
        <Input
          id="claim-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: Colis arrivé cassé, écran fissuré"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claim-desc">Description détaillée *</Label>
        <Textarea
          id="claim-desc"
          required
          rows={4}
          minLength={10}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrire le problème constaté, contexte, témoins…"
        />
        <p className="text-xs text-muted-foreground">
          Joignez les photos en pièces jointes via la section Documents ci-dessus (type Photo).
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Annuler</Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Ouverture…" : "Ouvrir la réclamation"}
        </Button>
      </div>
    </form>
  );
}
