"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderLinesTable } from "@/components/catalogues/order-lines-table";
import { saveCatalogQuote, updateCatalogOrderStatus } from "@/server/actions/catalogues";
import {
  CATALOG_CATEGORY_LABELS,
  CATALOG_ORDER_STATUS_LABELS,
  CATALOG_STAFF_STATUSES,
  type CatalogCategoryKey,
  type CatalogOrderStatusKey,
} from "@/lib/catalog-labels";
import { formatXOF } from "@/lib/utils";

type Item = {
  id: string;
  catalogId: string | null;
  catalogTitle: string;
  category: CatalogCategoryKey;
  reference: string;
  designation: string;
  page: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

type Order = {
  id: string;
  status: CatalogOrderStatusKey;
  staffNotes: string;
  feesAmount: number | null;
  totalAmount: number | null;
  quotedAt: string | null;
  items: Item[];
};

export function OrderEditor({ order }: { order: Order }) {
  const quoteEditable = order.status === "PENDING" || order.status === "QUOTED";
  return (
    <div className="space-y-6">
      {quoteEditable ? (
        <QuoteForm order={order} />
      ) : (
        <div className="space-y-3">
          <OrderLinesTable
            items={order.items}
            showPrices={order.totalAmount != null}
            feesAmount={order.feesAmount}
            totalAmount={order.totalAmount}
          />
          {order.staffNotes && (
            <p className="text-sm rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
              <span className="font-medium">Remarque jointe au devis : </span>
              {order.staffNotes}
            </p>
          )}
        </div>
      )}
      <StatusForm order={order} />
    </div>
  );
}

/** Établissement du devis : prix unitaires, frais annexes, remarque, envoi au client. */
function QuoteForm({ order }: { order: Order }) {
  const router = useRouter();
  const [lines, setLines] = useState(
    order.items.map((i) => ({
      id: i.id,
      quantity: String(i.quantity),
      unitPrice: i.unitPrice != null ? String(i.unitPrice) : "",
    })),
  );
  const [feesAmount, setFeesAmount] = useState(order.feesAmount != null ? String(order.feesAmount) : "");
  const [staffNotes, setStaffNotes] = useState(order.staffNotes);
  const [pending, setPending] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lineOf = (id: string) => lines.find((l) => l.id === id)!;
  const lineTotal = (id: string) => (Number(lineOf(id).quantity) || 0) * (Number(lineOf(id).unitPrice) || 0);
  const complete = lines.every((l) => l.unitPrice !== "");
  const total = order.items.reduce((s, i) => s + lineTotal(i.id), 0) + (Number(feesAmount) || 0);

  function update(id: string, patch: { quantity?: string; unitPrice?: string }) {
    setMessage(null);
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function save(send: boolean) {
    if (send && !confirm("Envoyer ce devis au client ? Il sera notifié et pourra l'accepter.")) return;
    setError(null);
    setMessage(null);
    setPending(send ? "send" : "draft");
    const res = await saveCatalogQuote({ id: order.id, items: lines, feesAmount, staffNotes, send });
    setPending(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setMessage(send ? "Devis envoyé au client." : "Brouillon enregistré (non envoyé au client).");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Devis</h3>
        <p className="text-xs text-muted-foreground">
          {order.status === "QUOTED" && order.quotedAt
            ? `Envoyé le ${order.quotedAt} — en attente de la réponse du client.`
            : "Renseignez les prix puis envoyez le devis au client."}
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead>Catalogue</TableHead>
              <TableHead className="w-24">Qté</TableHead>
              <TableHead className="w-40">Prix unitaire (FCFA)</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-sm">
                  <div className="font-medium">{i.designation}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {i.reference}
                    {i.page ? ` · p. ${i.page}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {i.catalogId ? (
                    <a
                      href={`/api/catalogue/${i.catalogId}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {i.catalogTitle}
                    </a>
                  ) : (
                    <span>{i.catalogTitle} (supprimé)</span>
                  )}
                  <div className="text-xs text-muted-foreground">{CATALOG_CATEGORY_LABELS[i.category]}</div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    step={1}
                    aria-label={`Quantité — ${i.designation}`}
                    value={lineOf(i.id).quantity}
                    onChange={(e) => update(i.id, { quantity: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="À chiffrer"
                    aria-label={`Prix unitaire — ${i.designation}`}
                    value={lineOf(i.id).unitPrice}
                    onChange={(e) => update(i.id, { unitPrice: e.target.value })}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {lineOf(i.id).unitPrice !== "" ? formatXOF(lineTotal(i.id)) : "—"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right text-sm">
                <Label htmlFor="qfees">Frais annexes (transport, emballage…)</Label>
              </TableCell>
              <TableCell>
                <Input
                  id="qfees"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={feesAmount}
                  onChange={(e) => {
                    setMessage(null);
                    setFeesAmount(e.target.value);
                  }}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {feesAmount !== "" ? formatXOF(Number(feesAmount) || 0) : "—"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4} className="text-right text-sm font-medium">
                Total du devis
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {complete ? formatXOF(total) : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qnotes">Remarque jointe au devis (visible par le client)</Label>
        <Textarea
          id="qnotes"
          rows={2}
          maxLength={2000}
          value={staffNotes}
          onChange={(e) => {
            setMessage(null);
            setStaffNotes(e.target.value);
          }}
          placeholder="Délai fournisseur, validité du devis, modalités de paiement…"
        />
      </div>

      {order.status === "QUOTED" && (
        <p className="text-xs text-muted-foreground">
          Enregistrer un brouillon retire le devis déjà envoyé : le client ne pourra l&apos;accepter qu&apos;après un
          nouvel envoi.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {message && <span className="text-sm text-muted-foreground mr-auto">{message}</span>}
        <Button type="button" variant="outline" disabled={pending !== null} onClick={() => save(false)}>
          {pending === "draft" ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
        <Button type="submit" disabled={pending !== null || !complete}>
          <Send className="h-4 w-4" />
          {pending === "send" ? "Envoi…" : order.status === "QUOTED" ? "Renvoyer le devis" : "Envoyer le devis"}
        </Button>
      </div>
    </form>
  );
}

/** Suivi de la commande une fois le devis envoyé (ou annulation à tout moment). */
function StatusForm({ order }: { order: Order }) {
  const router = useRouter();
  const current = (CATALOG_STAFF_STATUSES as readonly string[]).includes(order.status)
    ? (order.status as (typeof CATALOG_STAFF_STATUSES)[number])
    : order.status === "PENDING"
      ? "CANCELLED"
      : "CONFIRMED";
  const [status, setStatus] = useState(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sans devis envoyé, la seule action possible est l'annulation
  const noQuote = order.status === "PENDING";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await updateCatalogOrderStatus({ id: order.id, status });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label htmlFor="ostatus">Suivi de la commande</Label>
          <Select
            id="ostatus"
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof CATALOG_STAFF_STATUSES)[number])}
          >
            {CATALOG_STAFF_STATUSES.map((s) => (
              <option key={s} value={s} disabled={noQuote && s !== "CANCELLED"}>
                {CATALOG_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" disabled={loading || status === order.status}>
          {loading ? "…" : "Mettre à jour le statut"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/print/devis/${order.id}`}>
            <Printer className="h-4 w-4" /> {noQuote ? "Bon de commande" : "Devis"} imprimable
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le client peut accepter lui-même le devis depuis son espace. Utilisez ce suivi pour confirmer à sa place, puis
        indiquer la préparation, l&apos;expédition et la livraison.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
