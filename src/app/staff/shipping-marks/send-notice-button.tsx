"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendReceptionNotice } from "@/server/actions/shippingMarks";
import { formatXOF } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function SendReceptionNoticeButton({
  shippingMarkId,
  count,
  totalDeposit,
}: {
  shippingMarkId: string;
  count: number;
  totalDeposit: number;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setLoading(true);
    setError(null);
    const res = await sendReceptionNotice(shippingMarkId);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <span className="text-xs text-emerald-600 font-medium">
        Avis envoyé ✓
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handle} disabled={loading}>
        {loading ? "Envoi…" : `Notifier (${count} colis)`}
      </Button>
      <span className="text-xs text-muted-foreground">
        Acomptes : {formatXOF(totalDeposit)}
      </span>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
