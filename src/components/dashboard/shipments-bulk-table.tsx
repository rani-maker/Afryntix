"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShipmentStatusBadge, PaymentStatusBadge } from "./status-badge";
import { TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { formatDate, formatXOF } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkUpdateShipmentStatus, bulkAttachShipmentsToEnvoi } from "@/server/actions/bulk";
import type { ShipmentStatus, PaymentStatus, TransportMode } from "@prisma/client";

const STATUSES = Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[];

export type BulkShipmentRow = {
  id: string;
  trackingNumber: string;
  mode: TransportMode;
  status: ShipmentStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  amountPaid: number;
  createdAt: Date;
  client: { name: string; email?: string } | null;
};

export function ShipmentsBulkTable({
  rows,
  envois,
  manageHref,
}: {
  rows: BulkShipmentRow[];
  envois: { id: string; reference: string; mode: TransportMode }[];
  manageHref?: (id: string) => string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = selected.size === rows.length && rows.length > 0;
  const [action, setAction] = useState<"status" | "attach" | "detach">("status");
  const [status, setStatus] = useState<ShipmentStatus>("RECEIVED_CHINA");
  const [note, setNote] = useState("");
  const [envoiId, setEnvoiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const selectedModes = useMemo(() => new Set(selectedRows.map((r) => r.mode)), [selectedRows]);
  const sameMode = selectedModes.size === 1;
  const onlyMode = sameMode ? [...selectedModes][0] : null;
  const availableEnvois = onlyMode ? envois.filter((e) => e.mode === onlyMode) : [];

  async function apply() {
    setError(null); setSuccess(null);
    if (selected.size === 0) {
      setError("Aucun colis sélectionné");
      return;
    }
    setLoading(true);
    if (action === "status") {
      const res = await bulkUpdateShipmentStatus({
        ids: [...selected],
        status,
        note: note || undefined,
      });
      setLoading(false);
      if (!res.success) { setError(res.error); return; }
      setSuccess(`${res.data?.count ?? 0} colis mis à jour`);
    } else if (action === "attach") {
      if (!envoiId) { setError("Sélectionnez un envoi"); setLoading(false); return; }
      if (!sameMode) { setError("Tous les colis sélectionnés doivent avoir le même mode"); setLoading(false); return; }
      const res = await bulkAttachShipmentsToEnvoi({
        ids: [...selected],
        envoiId,
      });
      setLoading(false);
      if (!res.success) { setError(res.error); return; }
      setSuccess(`${res.data?.count ?? 0} colis rattachés`);
    } else if (action === "detach") {
      const res = await bulkAttachShipmentsToEnvoi({
        ids: [...selected],
        envoiId: null,
      });
      setLoading(false);
      if (!res.success) { setError(res.error); return; }
      setSuccess(`${res.data?.count ?? 0} colis détachés`);
    }
    setSelected(new Set());
    setNote("");
    router.refresh();
  }

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Aucune expédition.</div>;
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 border-b bg-amber-50 px-3 py-2 flex flex-wrap items-end gap-2 text-sm">
          <span className="font-semibold mr-2">
            {selected.size} colis sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div className="space-y-1">
            <Label htmlFor="bulk-action" className="text-xs">Action</Label>
            <Select
              id="bulk-action"
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              className="h-8"
            >
              <option value="status">Changer le statut</option>
              <option value="attach">Rattacher à un envoi</option>
              <option value="detach">Détacher de leur envoi</option>
            </Select>
          </div>
          {action === "status" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="bulk-status" className="text-xs">Nouveau statut</Label>
                <Select
                  id="bulk-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
                  className="h-8"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="bulk-note" className="text-xs">Note (optionnel)</Label>
                <Input id="bulk-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-8" />
              </div>
            </>
          )}
          {action === "attach" && (
            <div className="space-y-1 flex-1 min-w-[280px]">
              <Label htmlFor="bulk-envoi" className="text-xs">
                Envoi {onlyMode ? `(${TRANSPORT_MODE_LABELS[onlyMode]})` : "(sélection mixte)"}
              </Label>
              <Select
                id="bulk-envoi"
                value={envoiId}
                onChange={(e) => setEnvoiId(e.target.value)}
                className="h-8"
                disabled={!sameMode}
              >
                <option value="">— choisir —</option>
                {availableEnvois.map((e) => (
                  <option key={e.id} value={e.id}>{e.reference}</option>
                ))}
              </Select>
            </div>
          )}
          <Button size="sm" onClick={apply} disabled={loading} className="h-8">
            {loading ? "…" : "Appliquer"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="h-8">
            Annuler
          </Button>
          {error && <span className="text-xs text-destructive w-full">{error}</span>}
          {success && <span className="text-xs text-emerald-700 w-full">{success}</span>}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            </TableHead>
            <TableHead>Tracking</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Paiement</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Créé le</TableHead>
            {manageHref && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id} className={selected.has(s.id) ? "bg-amber-50/40" : undefined}>
              <TableCell>
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              </TableCell>
              <TableCell className="font-mono">
                <Link href={`/tracking/${s.trackingNumber}`} className="hover:text-primary">
                  {s.trackingNumber}
                </Link>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">{s.client?.name ?? "—"}</div>
                {s.client?.email && (
                  <div className="text-xs text-muted-foreground">{s.client.email}</div>
                )}
              </TableCell>
              <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[s.mode]}</TableCell>
              <TableCell><ShipmentStatusBadge status={s.status} /></TableCell>
              <TableCell><PaymentStatusBadge status={s.paymentStatus} /></TableCell>
              <TableCell className="text-right">
                <div className="font-medium">{formatXOF(s.totalAmount)}</div>
                {s.amountPaid > 0 && (
                  <div className="text-xs text-muted-foreground">Payé : {formatXOF(s.amountPaid)}</div>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
              {manageHref && (
                <TableCell className="text-right">
                  <Link href={manageHref(s.id)} className="text-sm text-primary hover:underline">
                    Gérer
                  </Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
