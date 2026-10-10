"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createCatalog,
  deleteCatalog,
  requestCatalogUpload,
  updateCatalog,
} from "@/server/actions/catalogues";
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  formatFileSize,
  type CatalogCategoryKey,
} from "@/lib/catalog-labels";

type CatalogRow = {
  id: string;
  category: CatalogCategoryKey;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number | null;
  hasCover: boolean;
  active: boolean;
  orderLines: number;
};

/**
 * Envoie le fichier directement à Supabase Storage via un lien signé
 * (même format multipart que `uploadToSignedUrl` de supabase-js).
 */
async function uploadFile(
  kind: "pdf" | "cover",
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const res = await requestCatalogUpload({ kind, mimeType: file.type, size: file.size });
  if (!res.success || !res.data) throw new Error(res.success ? "Upload impossible." : res.error);
  const { signedUrl, path } = res.data;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // Supabase répond 413 (ou 400 « exceeded the maximum allowed size ») au-delà de sa limite
      const tooLarge = xhr.status === 413 || /maximum allowed size/i.test(xhr.responseText);
      reject(
        new Error(
          tooLarge
            ? "Fichier refusé par le stockage : il dépasse la taille maximale autorisée sur le projet Supabase (Storage → Settings)."
            : `Envoi du fichier refusé (${xhr.status}).`,
        ),
      );
    };
    xhr.onerror = () => reject(new Error("Envoi du fichier interrompu. Vérifiez votre connexion."));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
  return path;
}

export function CatalogManager({ catalogs }: { catalogs: CatalogRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Ajouter un catalogue
          </Button>
        )}
      </div>

      {creating && <CatalogCreateForm onDone={() => setCreating(false)} />}

      {CATALOG_CATEGORIES.map((cat) => {
        const rows = catalogs.filter((c) => c.category === cat);
        return (
          <section key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold">
              {CATALOG_CATEGORY_LABELS[cat]}{" "}
              <span className="text-muted-foreground font-normal">({rows.length})</span>
            </h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
                Aucun catalogue dans cette catégorie.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((c) =>
                  editingId === c.id ? (
                    <li key={c.id} className="p-3">
                      <CatalogEditForm catalog={c} onDone={() => setEditingId(null)} />
                    </li>
                  ) : (
                    <CatalogItem key={c.id} catalog={c} onEdit={() => setEditingId(c.id)} />
                  ),
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CatalogItem({ catalog, onEdit }: { catalog: CatalogRow; onEdit: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    const res = await updateCatalog({ id: catalog.id, active: !catalog.active });
    setLoading(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    const warning =
      catalog.orderLines > 0
        ? `\n\n${catalog.orderLines} ligne(s) de commande y font référence : elles seront conservées avec le titre du catalogue.`
        : "";
    if (!confirm(`Supprimer définitivement « ${catalog.title} » et son fichier PDF ?${warning}`)) return;
    setLoading(true);
    const res = await deleteCatalog(catalog.id);
    setLoading(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium flex flex-wrap items-center gap-2">
          {catalog.title}
          <Badge variant={catalog.active ? "success" : "secondary"}>{catalog.active ? "Visible" : "Masqué"}</Badge>
        </div>
        {catalog.description && <p className="text-xs text-muted-foreground mt-1">{catalog.description}</p>}
        <a
          href={`/api/catalogue/${catalog.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
        >
          <FileText className="h-3 w-3" /> {catalog.fileName}
          {catalog.fileSize ? ` · ${formatFileSize(catalog.fileSize)}` : ""}
        </a>
        <div className="text-xs text-muted-foreground mt-0.5">
          {catalog.hasCover ? "Avec image de couverture" : "Sans image de couverture"}
          {catalog.orderLines > 0 ? ` · ${catalog.orderLines} ligne(s) commandée(s)` : ""}
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleActive}
          disabled={loading}
          aria-label={catalog.active ? "Masquer le catalogue" : "Rendre le catalogue visible"}
          title={catalog.active ? "Masquer" : "Rendre visible"}
        >
          {catalog.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Modifier le catalogue">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={loading}
          aria-label="Supprimer le catalogue"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function CatalogCreateForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<CatalogCategoryKey>("SANITAIRE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = progress !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdf) return;
    setError(null);
    setProgress(0);
    try {
      const filePath = await uploadFile("pdf", pdf, setProgress);
      const coverPath = cover ? await uploadFile("cover", cover) : undefined;
      const res = await createCatalog({
        category,
        title,
        description,
        filePath,
        fileName: pdf.name.slice(0, 200),
        fileSize: pdf.size,
        coverPath,
      });
      if (!res.success) throw new Error(res.error);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout du catalogue.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ccat">Catégorie *</Label>
          <Select id="ccat" value={category} onChange={(e) => setCategory(e.target.value as CatalogCategoryKey)}>
            {CATALOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATALOG_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ctitle">Titre *</Label>
          <Input
            id="ctitle"
            required
            minLength={2}
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Robinetterie & vasques 2026"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cdesc">Description</Label>
        <Textarea
          id="cdesc"
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cpdf">Fichier PDF * (max 300 Mo)</Label>
          <Input
            id="cpdf"
            type="file"
            required
            accept="application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ccover">Image de couverture (JPG, PNG, WebP — max 5 Mo)</Label>
          <Input
            id="ccover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      {loading && (
        <div className="space-y-1" role="status">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Envoi du catalogue… {progress}%</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={loading || !pdf || !title}>
          {loading ? "Envoi…" : "Publier le catalogue"}
        </Button>
      </div>
    </form>
  );
}

function CatalogEditForm({ catalog, onDone }: { catalog: CatalogRow; onDone: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<CatalogCategoryKey>(catalog.category);
  const [title, setTitle] = useState(catalog.title);
  const [description, setDescription] = useState(catalog.description ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const coverPath = cover ? await uploadFile("cover", cover) : undefined;
      const res = await updateCatalog({ id: catalog.id, category, title, description, coverPath });
      if (!res.success) throw new Error(res.error);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la mise à jour.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`ecat-${catalog.id}`}>Catégorie</Label>
          <Select
            id={`ecat-${catalog.id}`}
            value={category}
            onChange={(e) => setCategory(e.target.value as CatalogCategoryKey)}
          >
            {CATALOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATALOG_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`etitle-${catalog.id}`}>Titre</Label>
          <Input
            id={`etitle-${catalog.id}`}
            required
            minLength={2}
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edesc-${catalog.id}`}>Description</Label>
        <Textarea
          id={`edesc-${catalog.id}`}
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ecover-${catalog.id}`}>
          {catalog.hasCover ? "Remplacer l'image de couverture" : "Ajouter une image de couverture"}
        </Label>
        <Input
          id={`ecover-${catalog.id}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setCover(e.target.files?.[0] ?? null)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Pour remplacer le PDF, ajoutez un nouveau catalogue puis supprimez ou masquez celui-ci.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={loading || !title}>
          {loading ? "…" : "Mettre à jour"}
        </Button>
      </div>
    </form>
  );
}
