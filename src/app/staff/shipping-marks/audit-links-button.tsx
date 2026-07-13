"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auditIncorrectShippingMarkLinks } from "@/server/actions/shippingMarks";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type IncorrectLink = {
  markId: string;
  markName: string;
  markPhone: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  userWhatsapp: string | null;
};

type AuditData = { total: number; incorrect: IncorrectLink[]; unlinked: number };

export function AuditIncorrectLinksButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    const res = await auditIncorrectShippingMarkLinks({ apply: false });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setData(res.data!);
  }

  async function applyFix() {
    if (!data || data.incorrect.length === 0) return;
    if (
      !confirm(
        `Détacher ${data.incorrect.length} shipping mark(s) mal liée(s) ? Cette action est sans risque : les colis, factures et historiques restent intacts, seul le lien mark↔compte est supprimé.`,
      )
    )
      return;
    setApplying(true);
    setError(null);
    const res = await auditIncorrectShippingMarkLinks({ apply: true });
    setApplying(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setData(res.data!);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-amber-900">
            Diagnostic — Liaisons Shipping Mark ↔ Compte client
          </div>
          <p className="text-amber-800 mt-1">
            Un correctif applicatif a été déployé : les shipping marks de{" "}
            <strong>tiers destinataires</strong> ne sont plus rattachées par erreur au
            compte du client-payeur. Utilise ce diagnostic pour détacher les liens
            historiques incorrects et débloquer les envois vers des destinataires
            multiples.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={runAudit} disabled={loading}>
          {loading ? "Analyse…" : "Diagnostiquer"}
        </Button>
        {data && data.incorrect.length > 0 && (
          <Button size="sm" onClick={applyFix} disabled={applying}>
            {applying
              ? "Application…"
              : `Détacher ${data.incorrect.length} liaison(s)`}
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {data && (
        <div className="text-sm space-y-2">
          <div className="text-amber-900">
            <strong>{data.total}</strong> mark(s) liée(s) à un compte au total ·{" "}
            <strong className={data.incorrect.length > 0 ? "text-red-700" : "text-emerald-700"}>
              {data.incorrect.length}
            </strong>{" "}
            incorrecte(s)
            {data.unlinked > 0 && (
              <span className="text-emerald-700">
                {" "}
                · <CheckCircle2 className="h-4 w-4 inline" /> {data.unlinked}{" "}
                détachée(s) avec succès
              </span>
            )}
          </div>
          {data.incorrect.length > 0 && (
            <div className="rounded border border-amber-300 bg-white max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-amber-100 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5">Mark (name / phone)</th>
                    <th className="text-left px-3 py-1.5">→ Compte client lié</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incorrect.map((r) => (
                    <tr key={r.markId} className="border-t border-amber-100">
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{r.markName}</div>
                        <div className="text-muted-foreground">{r.markPhone}</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{r.userName}</div>
                        <div className="text-muted-foreground">
                          {r.userPhone ?? "—"}
                          {r.userWhatsapp ? ` / ${r.userWhatsapp}` : ""}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.incorrect.length === 0 && (
            <div className="text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Aucune liaison incorrecte détectée. La base est saine.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
