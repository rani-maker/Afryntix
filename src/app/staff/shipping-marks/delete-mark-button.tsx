"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteShippingMark } from "@/server/actions/shippingMarks";

type Props = {
  markId: string;
  markName: string;
  attachedCount: number;
};

export function DeleteShippingMarkButton({ markId, markName, attachedCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = attachedCount > 0;

  function onClick() {
    if (disabled) return;
    const ok = confirm(
      `Supprimer définitivement la shipping mark « ${markName} » ? Cette action est irréversible.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteShippingMark(markId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={disabled || pending}
        title={
          disabled
            ? "Mark rattachée à des colis ou factures — détache-les avant de supprimer."
            : "Supprimer cette mark"
        }
        className={
          disabled
            ? undefined
            : "text-destructive hover:text-destructive hover:bg-destructive/10"
        }
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Suppression…" : "Supprimer"}
      </Button>
      {error && <span className="text-xs text-destructive max-w-xs text-right">{error}</span>}
    </div>
  );
}
