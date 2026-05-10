"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateExchangeRateById,
  deleteExchangeRateById,
} from "@/server/actions/payments";

type Props = {
  id: string;
  fromCcy: string;
  toCcy: string;
  rate: number;
};

export function ExchangeRateRowActions({ id, fromCcy, toCcy, rate }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Taux invalide");
      return;
    }
    setLoading(true);
    const res = await updateExchangeRateById({ id, rate: n });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Supprimer ce taux ${fromCcy} → ${toCcy} ?`)) return;
    setLoading(true);
    const res = await deleteExchangeRateById(id);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-28 text-right"
          autoFocus
        />
        <Button size="sm" onClick={handleSave} disabled={loading}>
          {loading ? "…" : "OK"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(false);
            setValue(String(rate));
            setError(null);
          }}
          disabled={loading}
        >
          Annuler
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setEditing(true)}
        disabled={loading}
      >
        Modifier
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDelete}
        disabled={loading}
        className="text-destructive hover:text-destructive"
      >
        Supprimer
      </Button>
    </div>
  );
}
