"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadDocument, deleteDocument, DOCUMENT_TYPE_LABELS } from "@/server/actions/documents";
import { formatDateTime } from "@/lib/utils";
import { FileText, Image as ImageIcon, Trash2, Download, Plus } from "lucide-react";
import type { DocumentType } from "@prisma/client";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  label: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  createdAt: Date;
  uploadedBy?: { name: string } | null;
};

type Props = {
  documents: DocumentRow[];
  allowedTypes: readonly DocumentType[];
  target: { shipmentId: string } | { envoiId: string };
  canEdit?: boolean;
};

export function DocumentsSection({ documents, allowedTypes, target, canEdit = true }: Props) {
  const [openForm, setOpenForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {documents.length === 0
            ? "Aucun document pour le moment."
            : `${documents.length} document${documents.length > 1 ? "s" : ""}`}
        </p>
        {canEdit && (
          <Button size="sm" variant={openForm ? "outline" : "default"} onClick={() => setOpenForm((v) => !v)}>
            {openForm ? "Annuler" : (<><Plus className="h-4 w-4" /> Ajouter</>)}
          </Button>
        )}
      </div>

      {openForm && canEdit && (
        <UploadForm
          allowedTypes={allowedTypes}
          target={target}
          onDone={() => setOpenForm(false)}
        />
      )}

      {documents.length > 0 && (
        <ul className="divide-y rounded-md border">
          {documents.map((d) => (
            <DocumentRow key={d.id} doc={d} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRow({ doc, canEdit }: { doc: DocumentRow; canEdit: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const isImage = doc.mimeType?.startsWith("image/");

  async function handleDelete() {
    if (!confirm(`Supprimer ce document : ${doc.fileName} ?`)) return;
    setDeleting(true);
    const res = await deleteDocument(doc.id);
    setDeleting(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 p-3 text-sm">
      <div className="text-muted-foreground">
        {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
          {doc.label && <span className="text-xs text-muted-foreground">· {doc.label}</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {doc.fileName}
          {doc.fileSize != null && <> · {formatBytes(doc.fileSize)}</>}
          {" · "}
          {formatDateTime(doc.createdAt)}
          {doc.uploadedBy && <> · {doc.uploadedBy.name}</>}
        </div>
        {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{doc.notes}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="sm" variant="outline">
          <a href={doc.fileUrl} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Ouvrir
          </a>
        </Button>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </li>
  );
}

function UploadForm({
  allowedTypes,
  target,
  onDone,
}: {
  allowedTypes: readonly DocumentType[];
  target: { shipmentId: string } | { envoiId: string };
  onDone: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>(allowedTypes[0] ?? "OTHER");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choisissez un fichier");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 15 Mo)");
      return;
    }
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await uploadDocument({
        type,
        label: label || undefined,
        notes: notes || undefined,
        fileBase64: base64,
        fileName: file.name,
        ...target,
      });
      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setLoading(false);
      onDone();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">Type de document</Label>
          <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {allowedTypes.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-label">Libellé (optionnel)</Label>
          <Input
            id="doc-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: AWB 235-12345678"
            maxLength={120}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-file">Fichier (PDF, image, Word, Excel — max 15 Mo)</Label>
        <Input
          id="doc-file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.xls,.xlsx,.doc,.docx,image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-notes">Notes (optionnel)</Label>
        <Textarea
          id="doc-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
      </div>
      <div className="flex items-center justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Envoi…" : "Téléverser"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
