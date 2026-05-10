"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { attachShipmentsToEnvoi } from "@/server/actions/envois";

type Shipment = {
  id: string;
  trackingNumber: string;
  clientLabel: string;
  destination: string;
};

type Container = { id: string; refInternal: string; carrierNumber: string | null };

export function AttachShipmentsForm({
  envoiId,
  containers,
  shipments,
}: {
  envoiId: string;
  containers: Container[];
  shipments: Shipment[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [containerId, setContainerId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = filter
    ? shipments.filter((s) =>
        [s.trackingNumber, s.clientLabel, s.destination].join(" ").toLowerCase().includes(filter.toLowerCase()),
      )
    : shipments;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (selected.size === 0) {
      setError("Sélectionner au moins un colis.");
      return;
    }
    setLoading(true);
    const res = await attachShipmentsToEnvoi({
      envoiId,
      shipmentIds: Array.from(selected),
      containerId: containerId || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setInfo(`${res.data?.count ?? 0} colis rattaché(s).`);
    setSelected(new Set());
    router.refresh();
  }

  if (shipments.length === 0) {
    return <div className="text-sm text-muted-foreground">Aucun colis disponible pour ce mode d&apos;envoi.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {info && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Filtrer</Label>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tracking, client, ville…" />
        </div>
        {containers.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Affecter à un conteneur (optionnel)</Label>
            <Select value={containerId} onChange={(e) => setContainerId(e.target.value)}>
              <option value="">— Aucun —</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.refInternal}{c.carrierNumber ? ` · ${c.carrierNumber}` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="border rounded-md max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left">Tracking</th>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Destination</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Aucun colis ne correspond au filtre.</td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(s.id)}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.trackingNumber}</td>
                  <td className="px-3 py-2">{s.clientLabel}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{s.destination || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button type="submit" disabled={loading || selected.size === 0}>
        {loading ? "Rattachement…" : `Rattacher ${selected.size} colis`}
      </Button>
    </form>
  );
}
