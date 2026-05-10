"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addContainer, updateContainer, deleteContainer } from "@/server/actions/envois";
import { CONTAINER_TYPE_LABELS } from "@/lib/pricing";
import type { ContainerType } from "@prisma/client";

const TYPES: ContainerType[] = [
  "TWENTY_GP", "FORTY_GP", "FORTY_HQ", "FORTY_FIVE",
  "REEFER_20", "REEFER_40", "OPEN_TOP", "FLAT_RACK", "OTHER",
];

type Container = {
  id: string;
  refInternal: string;
  carrierNumber: string | null;
  sealNumber: string | null;
  type: ContainerType | null;
  notes: string | null;
};

export function ContainerSection({
  envoiId,
  containers,
}: {
  envoiId: string;
  containers: Container[];
}) {
  return (
    <div className="space-y-6">
      <ExistingContainers containers={containers} />
      <AddContainerForm envoiId={envoiId} suggestedRef={`AFR-CTN-${new Date().getFullYear()}-${String(containers.length + 1).padStart(4, "0")}`} />
    </div>
  );
}

function ExistingContainers({ containers }: { containers: Container[] }) {
  if (containers.length === 0) {
    return <div className="text-sm text-muted-foreground">Aucun conteneur. Ajoutez-en un ci-dessous.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Réf interne</TableHead>
          <TableHead>N° carrier</TableHead>
          <TableHead>Sceau</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {containers.map((c) => (
          <ContainerRow key={c.id} container={c} />
        ))}
      </TableBody>
    </Table>
  );
}

function ContainerRow({ container }: { container: Container }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [carrierNumber, setCarrierNumber] = useState(container.carrierNumber ?? "");
  const [sealNumber, setSealNumber] = useState(container.sealNumber ?? "");
  const [type, setType] = useState<ContainerType | "">(container.type ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setLoading(true);
    const res = await updateContainer({
      containerId: container.id,
      carrierNumber,
      sealNumber,
      type: type || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer le conteneur ${container.refInternal} ? Les colis seront détachés.`)) return;
    setLoading(true);
    const res = await deleteContainer({ containerId: container.id });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell className="font-mono text-xs">{container.refInternal}</TableCell>
        <TableCell>
          <Input value={carrierNumber} onChange={(e) => setCarrierNumber(e.target.value)} placeholder="ex : MSCU1234567" className="font-mono text-xs" />
        </TableCell>
        <TableCell>
          <Input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className="text-xs" />
        </TableCell>
        <TableCell>
          <Select value={type} onChange={(e) => setType(e.target.value as ContainerType | "")} className="text-xs">
            <option value="">—</option>
            {TYPES.map((t) => <option key={t} value={t}>{CONTAINER_TYPE_LABELS[t]}</option>)}
          </Select>
        </TableCell>
        <TableCell className="text-right space-x-2">
          {error && <div className="text-xs text-destructive">{error}</div>}
          <Button size="sm" onClick={save} disabled={loading}>Enregistrer</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={loading}>Annuler</Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{container.refInternal}</TableCell>
      <TableCell className="font-mono text-xs">
        {container.carrierNumber ?? <span className="text-muted-foreground italic">à renseigner</span>}
      </TableCell>
      <TableCell className="text-xs">{container.sealNumber ?? "—"}</TableCell>
      <TableCell className="text-xs">{container.type ? CONTAINER_TYPE_LABELS[container.type] : "—"}</TableCell>
      <TableCell className="text-right space-x-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={loading}>Supprimer</Button>
      </TableCell>
    </TableRow>
  );
}

function AddContainerForm({ envoiId, suggestedRef }: { envoiId: string; suggestedRef: string }) {
  const router = useRouter();
  const [refInternal, setRefInternal] = useState(suggestedRef);
  const [carrierNumber, setCarrierNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [type, setType] = useState<ContainerType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await addContainer({
      envoiId,
      refInternal,
      carrierNumber: carrierNumber || undefined,
      sealNumber: sealNumber || undefined,
      type: type || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setCarrierNumber("");
    setSealNumber("");
    setType("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <div className="text-xs font-medium text-muted-foreground uppercase">Ajouter un conteneur</div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Réf interne *</Label>
          <Input value={refInternal} onChange={(e) => setRefInternal(e.target.value)} className="font-mono text-xs" required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N° carrier (optionnel)</Label>
          <Input value={carrierNumber} onChange={(e) => setCarrierNumber(e.target.value)} placeholder="MSCU1234567" className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sceau</Label>
          <Input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as ContainerType | "")} className="text-xs">
            <option value="">—</option>
            {TYPES.map((t) => <option key={t} value={t}>{CONTAINER_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Ajout…" : "Ajouter le conteneur"}
      </Button>
    </form>
  );
}
