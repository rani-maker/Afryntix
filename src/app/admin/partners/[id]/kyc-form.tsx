"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  updatePartnerKycInfo,
  uploadPartnerKycFile,
  getPartnerDocumentSignedUrl,
  deletePartnerKycFile,
} from "@/server/actions/partners";

type Props = {
  partnerId: string;
  idDocumentNumber: string | null;
  idDocumentUrl: string | null;
  contractUrl: string | null;
  contractSignedAt: Date | null;
};

export function KycForm({
  partnerId,
  idDocumentNumber,
  idDocumentUrl,
  contractUrl,
  contractSignedAt,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);

  async function handleInfoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoMsg(null);
    setInfoErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updatePartnerKycInfo({
        partnerId,
        idDocumentNumber: String(fd.get("idDocumentNumber") ?? ""),
        contractSignedAt: String(fd.get("contractSignedAt") ?? "") || undefined,
      });
      if (!res.success) {
        setInfoErr(res.error);
        return;
      }
      setInfoMsg("Informations enregistrées.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* === Section 1 : Numéro pièce d'identité === */}
      <form onSubmit={handleInfoSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="idDocumentNumber">Numéro de pièce d'identité (CNI, passeport…)</Label>
          <Input
            id="idDocumentNumber"
            name="idDocumentNumber"
            defaultValue={idDocumentNumber ?? ""}
            placeholder="Ex: CI001234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contractSignedAt">Date de signature du contrat</Label>
          <Input
            id="contractSignedAt"
            name="contractSignedAt"
            type="date"
            defaultValue={contractSignedAt ? new Date(contractSignedAt).toISOString().slice(0, 10) : ""}
          />
        </div>
        {infoErr && <p className="text-sm text-destructive">{infoErr}</p>}
        {infoMsg && <p className="text-sm text-emerald-700">{infoMsg}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Enregistrer les infos"}
        </Button>
      </form>

      <div className="border-t pt-4">
        {/* === Section 2 : Upload pièce d'identité === */}
        <DocumentUploader
          partnerId={partnerId}
          kind="id-document"
          label="Pièce d'identité (scan / photo)"
          help="JPG, PNG, WebP, HEIC ou PDF — max 10 Mo"
          hasFile={!!idDocumentUrl}
        />
      </div>

      <div className="border-t pt-4">
        {/* === Section 3 : Contrat === */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Contrat de partenariat</Label>
            <p className="text-xs text-muted-foreground">
              1. Générez le modèle pré-rempli ci-dessous.
              2. Imprimez-le. 3. Faites-le signer. 4. Scannez et uploadez la version signée.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/partners/${partnerId}/contract`} target="_blank">
                📄 Générer le modèle de contrat à signer
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <DocumentUploader
            partnerId={partnerId}
            kind="contract-signed"
            label="Contrat signé (scan)"
            help="PDF recommandé — max 10 Mo"
            hasFile={!!contractUrl}
          />
        </div>
      </div>
    </div>
  );
}

function DocumentUploader({
  partnerId,
  kind,
  label,
  help,
  hasFile,
}: {
  partnerId: string;
  kind: "id-document" | "contract-signed";
  label: string;
  help: string;
  hasFile: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setMsg(null);
    setProgress(`Envoi de ${file.name}…`);

    const fd = new FormData();
    fd.set("partnerId", partnerId);
    fd.set("kind", kind);
    fd.set("file", file);

    start(async () => {
      const res = await uploadPartnerKycFile(fd);
      setProgress(null);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setMsg("Fichier téléversé.");
      router.refresh();
    });
    // Reset input pour permettre de re-sélectionner le même fichier
    e.target.value = "";
  }

  async function handleView() {
    setErr(null);
    const res = await getPartnerDocumentSignedUrl(partnerId, kind);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    window.open(res.data!.url, "_blank");
  }

  function handleDelete() {
    if (!confirm("Supprimer ce document ?")) return;
    setErr(null);
    start(async () => {
      const res = await deletePartnerKycFile(partnerId, kind);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hasFile && <Badge variant="success">Téléversé</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            onChange={handleUpload}
            disabled={pending}
            className="hidden"
          />
          <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-9 px-3 text-sm hover:bg-primary/90 disabled:opacity-50">
            {hasFile ? "Remplacer le fichier" : "Choisir un fichier"}
          </span>
        </label>

        {hasFile && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={handleView} disabled={pending}>
              👁️ Voir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={pending}
              className="text-red-600 hover:text-red-700"
            >
              Supprimer
            </Button>
          </>
        )}
      </div>

      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </div>
  );
}
