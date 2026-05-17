import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { basename, extname } from "path";
import { Readable } from "stream";
import { auth } from "@/auth";
import { FILE_URL_PREFIX, resolveUploadedFilePath } from "@/lib/storage";

/**
 * Route protégée de service de fichiers uploadés.
 *
 * Sécurité :
 *  - Toute requête exige une session NextAuth valide (n'importe quel rôle).
 *  - Le chemin demandé est validé contre une remontée (`..`, barres arrière,
 *    chemins absolus) puis confiné sous la racine de stockage autorisée
 *    (voir `resolveUploadedFilePath`).
 *  - Compatibilité legacy : les fichiers historiques sous `public/uploads/`
 *    restent lisibles via `/api/files/{path}` le temps de la migration.
 *
 * NB : pour stopper réellement l'accès direct aux anciens fichiers, il faut
 * lancer le script de migration qui déplace `public/uploads/*` vers
 * `private-uploads/*` ET réécrit les URLs en base.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: parts } = await ctx.params;
  if (!parts || parts.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  // `parts` est déjà décodé par Next ; on reconstruit le chemin applicatif
  // pour repasser par `resolveUploadedFilePath` (anti-traversal centralisé).
  const fileUrl = `${FILE_URL_PREFIX}/${parts.join("/")}`;

  const resolved = await resolveUploadedFilePath(fileUrl);
  if (!resolved) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { absolutePath } = resolved;
  const st = await stat(absolutePath);

  const ext = extname(absolutePath).toLowerCase();
  const contentType = mimeFromExt(ext);
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(st.size),
    // `inline` : ouvre dans l'onglet pour les PDF/images. Le client peut
    // toujours forcer un téléchargement côté UI via download attribute.
    "Content-Disposition": `inline; filename="${basename(absolutePath).replace(/"/g, "")}"`,
    // Empêche le moteur de cache CDN/public de stocker des documents
    // potentiellement confidentiels.
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    // Pour les images servies en `inline`, on refuse l'embedding tiers.
    "X-Frame-Options": "SAMEORIGIN",
  });

  const nodeStream = createReadStream(absolutePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, { status: 200, headers });
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}
