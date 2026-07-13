"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, Send } from "lucide-react";
import { sendPackingListToMark } from "@/server/actions/packingLists";

type MarkGroup = {
  markId: string;
  markName: string;
  markPhone: string;
  linkedUserEmail: string | null;
  fallbackClientEmail: string | null;
  fallbackClientName: string | null;
  packagesCount: number;
  totalPieces: number;
  totalWeight: number;
  totalCBM: number;
  lastSentAt: string | null;
  lastSentTo: string | null;
};

export function PackingListsSection({
  envoiId,
  groups,
}: {
  envoiId: string;
  groups: MarkGroup[];
}) {
  const router = useRouter();
  const [busyMarkId, setBusyMarkId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function handleSend(markId: string) {
    const overrideEmail = overrides[markId]?.trim() || undefined;
    setBusyMarkId(markId);
    setFeedback((f) => ({ ...f, [markId]: { ok: true, msg: "Envoi en cours…" } }));
    const res = await sendPackingListToMark({ envoiId, markId, overrideEmail });
    setBusyMarkId(null);
    if (!res.success) {
      setFeedback((f) => ({ ...f, [markId]: { ok: false, msg: res.error } }));
      return;
    }
    setFeedback((f) => ({ ...f, [markId]: { ok: true, msg: `Envoyé à ${res.to}` } }));
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
          <TableHead>Shipping mark</TableHead>
          <TableHead>Destinataire</TableHead>
          <TableHead className="text-right">Colis</TableHead>
          <TableHead className="text-right">Poids (kg)</TableHead>
          <TableHead className="text-right">CBM</TableHead>
          <TableHead>Email destinataire</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => {
          const defaultEmail = g.linkedUserEmail ?? g.fallbackClientEmail ?? "";
          const fb = feedback[g.markId];
          return (
            <TableRow key={g.markId}>
              <TableCell className="align-top">
                <div className="font-medium">{g.markName}</div>
                <div className="text-xs text-muted-foreground">{g.markPhone}</div>
                {g.lastSentAt && (
                  <div className="text-xs text-emerald-700 mt-1">
                    ✓ Dernier envoi : {new Date(g.lastSentAt).toLocaleString("fr-FR")}
                    {g.lastSentTo ? ` → ${g.lastSentTo}` : ""}
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top text-sm">
                {g.fallbackClientName ?? "—"}
              </TableCell>
              <TableCell className="align-top text-right">
                {g.packagesCount}
                <div className="text-xs text-muted-foreground">
                  {g.totalPieces} pièces
                </div>
              </TableCell>
              <TableCell className="align-top text-right">
                {g.totalWeight.toFixed(2)}
              </TableCell>
              <TableCell className="align-top text-right">
                {g.totalCBM.toFixed(3)}
              </TableCell>
              <TableCell className="align-top">
                <Input
                  type="email"
                  defaultValue={defaultEmail}
                  placeholder="email destinataire"
                  className="h-8 text-xs"
                  onChange={(e) =>
                    setOverrides((o) => ({ ...o, [g.markId]: e.target.value }))
                  }
                />
                {!g.linkedUserEmail && g.fallbackClientEmail && (
                  <div className="text-[10px] text-amber-700 mt-1">
                    ⚠ Compte client utilisé (mark non lié à un utilisateur)
                  </div>
                )}
                {!g.linkedUserEmail && !g.fallbackClientEmail && (
                  <div className="text-[10px] text-red-700 mt-1">
                    Aucun email en base — saisir manuellement
                  </div>
                )}
                {fb && (
                  <div
                    className={`text-[11px] mt-1 ${fb.ok ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {fb.msg}
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top text-right">
                <div className="flex justify-end gap-1.5 flex-wrap">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/print/packing-list/envoi/${envoiId}/mark/${g.markId}`}
                      target="_blank"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/api/packing-list/envoi/${envoiId}/mark/${g.markId}`}>
                      <Download className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSend(g.markId)}
                    disabled={busyMarkId === g.markId}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {busyMarkId === g.markId ? "…" : "Envoyer"}
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
