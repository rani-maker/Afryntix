"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, MessageCircle } from "lucide-react";
import { ensureFactureForEnvoiMark } from "@/server/actions/factures";
import { formatXOF } from "@/lib/utils";

export type InvoiceGroup = {
  markId: string;
  clientName: string;
  clientPhone: string;
  accountLabel: string | null;
  packagesCount: number;
  total: number;
  paid: number;
  factureReferences: string[];
};

export function InvoicesSection({ envoiId, groups }: { envoiId: string; groups: InvoiceGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function open(markId: string, target: "print" | "whatsapp") {
    // L'onglet est ouvert dans le geste du clic (sinon le navigateur le bloque), puis redirigé.
    const tab = window.open("about:blank", "_blank");
    setBusy(`${markId}:${target}`);
    setErrors((e) => ({ ...e, [markId]: "" }));
    const res = await ensureFactureForEnvoiMark({ envoiId, markId });
    setBusy(null);
    const url = !res.success
      ? null
      : target === "print"
        ? `/print/facture/${res.data!.factureId}`
        : res.data!.whatsappUrl;
    if (!url) {
      tab?.close();
      setErrors((e) => ({
        ...e,
        [markId]: res.success ? "Numéro WhatsApp manquant ou invalide pour ce client." : res.error,
      }));
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
    router.refresh();
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Aucun colis rattaché à un shipping mark sur cet envoi.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client (shipping mark)</TableHead>
          <TableHead className="text-right">Colis</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Payé</TableHead>
          <TableHead className="text-right">Reste</TableHead>
          <TableHead>Facture</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => {
          const remaining = Math.max(0, g.total - g.paid);
          return (
            <TableRow key={g.markId}>
              <TableCell className="align-top">
                <div className="font-medium">{g.clientName}</div>
                <div className="text-xs font-mono text-muted-foreground">{g.clientPhone}</div>
                {g.accountLabel && <div className="text-xs text-muted-foreground">{g.accountLabel}</div>}
                {errors[g.markId] && <div className="text-[11px] text-red-700 mt-1">{errors[g.markId]}</div>}
              </TableCell>
              <TableCell className="align-top text-right">{g.packagesCount}</TableCell>
              <TableCell className="align-top text-right font-medium whitespace-nowrap">{formatXOF(g.total)}</TableCell>
              <TableCell className="align-top text-right whitespace-nowrap">{formatXOF(g.paid)}</TableCell>
              <TableCell className="align-top text-right whitespace-nowrap">
                {remaining > 0 ? (
                  <span className="font-semibold">{formatXOF(remaining)}</span>
                ) : (
                  <Badge variant="success">Soldé</Badge>
                )}
              </TableCell>
              <TableCell className="align-top">
                {g.factureReferences.length > 0 ? (
                  g.factureReferences.map((r) => (
                    <div key={r} className="font-mono text-xs">
                      {r}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Pas encore générée</span>
                )}
              </TableCell>
              <TableCell className="align-top text-right">
                <div className="flex justify-end gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => open(g.markId, "print")}
                    disabled={busy !== null}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    {busy === `${g.markId}:print` ? "…" : "Facture PDF"}
                  </Button>
                  <Button size="sm" onClick={() => open(g.markId, "whatsapp")} disabled={busy !== null}>
                    <MessageCircle className="h-4 w-4 mr-1" />
                    {busy === `${g.markId}:whatsapp` ? "…" : "WhatsApp"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
