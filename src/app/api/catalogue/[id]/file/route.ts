import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchCatalogObject } from "@/lib/supabase-storage";

type CatalogFile = { filePath: string; title: string; active: boolean };

// La visionneuse (/catalogue/[id]) lit le PDF par petites plages d'octets : on
// garde la fiche du catalogue quelques instants en mémoire pour ne pas
// interroger la base à chaque requête partielle.
const LOOKUP_TTL_MS = 60_000;
const LOOKUP_MAX_ENTRIES = 500;
const _lookups = new Map<string, { row: CatalogFile | null; until: number }>();

async function findCatalogFile(id: string): Promise<CatalogFile | null> {
  const hit = _lookups.get(id);
  if (hit && hit.until > Date.now()) return hit.row;
  const row = await prisma.catalog.findUnique({
    where: { id },
    select: { filePath: true, title: true, active: true },
  });
  if (_lookups.size >= LOOKUP_MAX_ENTRIES) _lookups.clear();
  _lookups.set(id, { row, until: Date.now() + LOOKUP_TTL_MS });
  return row;
}

function contentDisposition(title: string, download: boolean): string {
  const name = `AFRYNTIX - ${title.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim() || "Catalogue"}.pdf`;
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Sert le PDF d'un catalogue depuis le bucket privé, sous l'adresse du site
 * (proxy en flux continu : rien n'est mis en mémoire). Les requêtes partielles
 * (Range) sont relayées, ce qui permet d'afficher les premières pages sans
 * télécharger tout le fichier.
 * Public pour les catalogues actifs ; les catalogues masqués restent
 * consultables par le staff / l'admin. `?download=1` force le téléchargement.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const catalog = await findCatalogFile(id);
  if (!catalog) return new NextResponse("Not found", { status: 404 });

  if (!catalog.active) {
    const session = await auth();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "STAFF") return new NextResponse("Not found", { status: 404 });
  }

  // Le PDF d'un catalogue n'est jamais remplacé (filePath fixe) : cache long côté navigateur.
  const etag = `"${createHash("sha1").update(catalog.filePath).digest("hex").slice(0, 20)}"`;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Cache-Control": catalog.active ? "public, max-age=86400" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  let range = req.headers.get("range");
  if (range && !/^bytes=(\d+-\d*|-\d+)$/.test(range.trim())) range = null;
  const ifRange = req.headers.get("if-range");
  if (range && ifRange && ifRange !== etag) range = null;

  if (!range && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  let upstream: Response;
  try {
    upstream = await fetchCatalogObject(catalog.filePath, { range, signal: req.signal });
  } catch (e) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("[catalogue/file]", e);
    return new NextResponse("Fichier indisponible", { status: 502 });
  }

  const contentRange = upstream.headers.get("content-range");
  if (upstream.status === 416) {
    await upstream.body?.cancel().catch(() => {});
    if (contentRange) headers.set("Content-Range", contentRange);
    return new NextResponse(null, { status: 416, headers });
  }
  if (upstream.status !== 200 && upstream.status !== 206) {
    await upstream.body?.cancel().catch(() => {});
    console.error("[catalogue/file] réponse stockage inattendue :", upstream.status);
    return new NextResponse("Fichier indisponible", { status: 502 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", contentDisposition(catalog.title, download));
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  if (upstream.status === 206 && contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
