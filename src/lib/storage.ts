import { writeFile, mkdir, unlink, stat } from "fs/promises";
import { join, resolve, extname } from "path";
import { randomBytes } from "crypto";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Répertoire racine pour les fichiers uploadés.
 * IMPORTANT : ce répertoire DOIT être hors de `public/` afin que Next ne les
 * serve pas directement. L'accès aux fichiers passe par la route protégée
 * `/api/files/[...path]` qui vérifie l'authentification.
 *
 * - Par défaut : `<cwd>/private-uploads/` (hors du dossier public)
 * - Surcharger via `UPLOAD_DIR` (chemin relatif au cwd ou absolu) si besoin
 *   (typiquement un volume persistant en prod).
 */
export function baseUploadDir() {
  return process.env.UPLOAD_DIR
    ? resolve(process.cwd(), process.env.UPLOAD_DIR)
    : join(process.cwd(), "private-uploads");
}

/**
 * Chemin disque legacy. Pendant la migration depuis le stockage public,
 * certains fichiers historiques peuvent encore se trouver sous
 * `public/uploads/`. La route `/api/files/...` les sert également en
 * lecture seule (avec auth) jusqu'à ce que la migration soit terminée.
 */
export function legacyPublicUploadDir() {
  return join(process.cwd(), "public", "uploads");
}

/**
 * Préfixe public servi par la route protégée. Tout fichier stocké est
 * référencé via cette URL dans la base.
 */
export const FILE_URL_PREFIX = "/api/files";

export type DataUrl = `data:${string};base64,${string}`;

export type SavedFile = {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

/**
 * Sauvegarde un fichier encodé en base64 (format data URL ou simple base64)
 * dans le sous-dossier indiqué sous `private-uploads/`. Le fichier n'est
 * PAS accessible directement : il faut passer par la route protégée
 * `/api/files/[...path]`. Retourne l'URL applicative (préfixe `/api/files/...`)
 * et les métadonnées.
 */
export async function saveBase64File(opts: {
  base64: string;
  subfolder: string; // ex: "documents", "reservations"
  originalName?: string;
  fallbackMime?: string;
}): Promise<SavedFile> {
  const { base64, subfolder, originalName, fallbackMime } = opts;

  let mime: string;
  let payload: string;
  const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mime = dataUrlMatch[1];
    payload = dataUrlMatch[2];
  } else {
    mime = fallbackMime ?? "application/octet-stream";
    payload = base64;
  }

  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Type de fichier non autorisé : ${mime}`);
  }

  const buffer = Buffer.from(payload, "base64");
  if (buffer.byteLength === 0) throw new Error("Fichier vide");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} Mo)`);
  }

  // Défense en profondeur : vérifie que les octets de tête correspondent
  // au MIME déclaré. Empêche un upload d'EXE déguisé en `image/jpeg`.
  if (!matchesMagicBytes(buffer, mime)) {
    throw new Error(`Contenu du fichier incompatible avec le type déclaré (${mime}).`);
  }

  const dir = join(baseUploadDir(), subfolder);
  await mkdir(dir, { recursive: true });

  const safeOriginal = originalName ? originalName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) : null;
  const ext = safeOriginal ? extname(safeOriginal) : mimeToExt(mime);
  const baseName = safeOriginal
    ? safeOriginal.replace(/\.[^.]+$/, "")
    : "file";
  const unique = randomBytes(8).toString("hex");
  const fileName = `${baseName}-${Date.now()}-${unique}${ext}`;
  const filepath = join(dir, fileName);
  await writeFile(filepath, buffer);

  return {
    url: `${FILE_URL_PREFIX}/${subfolder}/${fileName}`,
    fileName: safeOriginal ?? fileName,
    fileSize: buffer.byteLength,
    mimeType: mime,
  };
}

/**
 * Convertit une URL applicative en chemin relatif au répertoire racine.
 * Accepte les deux formats :
 *  - nouveau : `/api/files/{subfolder}/{file}`
 *  - legacy  : `/uploads/{subfolder}/{file}` (fichiers historiques)
 * Renvoie `null` si l'URL n'est pas reconnue ou contient une remontée de path.
 */
export function urlToRelativePath(fileUrl: string): { rel: string; legacy: boolean } | null {
  let rel: string | null = null;
  let legacy = false;
  if (fileUrl.startsWith(`${FILE_URL_PREFIX}/`)) {
    rel = fileUrl.slice(FILE_URL_PREFIX.length + 1);
  } else if (fileUrl.startsWith("/uploads/")) {
    rel = fileUrl.slice("/uploads/".length);
    legacy = true;
  }
  if (!rel) return null;
  // Anti-traversal : on refuse `..`, les chemins absolus et toute barre arrière.
  if (rel.includes("..") || rel.includes("\\") || rel.startsWith("/")) return null;
  return { rel, legacy };
}

/**
 * Résout l'URL applicative en chemin disque réel, après vérifications de
 * sécurité (anti-traversal + le chemin doit rester confiné dans la racine
 * autorisée). Renvoie `null` si l'URL est invalide ou si le fichier n'existe
 * pas sur disque.
 */
export async function resolveUploadedFilePath(fileUrl: string): Promise<{
  absolutePath: string;
  legacy: boolean;
} | null> {
  const parsed = urlToRelativePath(fileUrl);
  if (!parsed) return null;
  const baseDir = parsed.legacy ? legacyPublicUploadDir() : baseUploadDir();
  const absolute = resolve(baseDir, parsed.rel);
  // Garde-fou : `resolve` peut absorber `..` — on vérifie que le chemin
  // résolu reste sous la racine attendue.
  const baseResolved = resolve(baseDir) + "/";
  if (!absolute.startsWith(baseResolved)) return null;
  try {
    const s = await stat(absolute);
    if (!s.isFile()) return null;
  } catch {
    return null;
  }
  return { absolutePath: absolute, legacy: parsed.legacy };
}

export async function deleteUploadedFile(fileUrl: string): Promise<void> {
  const parsed = urlToRelativePath(fileUrl);
  if (!parsed) return;
  const baseDir = parsed.legacy ? legacyPublicUploadDir() : baseUploadDir();
  const absolute = resolve(baseDir, parsed.rel);
  const baseResolved = resolve(baseDir) + "/";
  if (!absolute.startsWith(baseResolved)) return;
  try {
    await unlink(absolute);
  } catch {
    // best effort
  }
}

/**
 * Vérifie les "magic bytes" (signature en début de fichier) contre le MIME déclaré.
 * Le MIME du data URL peut être falsifié par le client — cette vérification serveur
 * empêche un attaquant de soumettre un exécutable étiqueté image/jpeg.
 *
 * Note : office documents (.docx/.xlsx) sont des zips → signature PK. .doc/.xls sont
 * du OLE Compound Document → signature D0 CF 11 E0.
 */
function matchesMagicBytes(buf: Buffer, mime: string): boolean {
  const startsWith = (sig: number[]): boolean => {
    if (buf.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return false;
    return true;
  };

  switch (mime) {
    case "application/pdf":
      return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/jpeg":
    case "image/jpg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      // RIFF....WEBP
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        buf.length >= 12 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
      );
    case "image/heic":
      // ftyp box à l'offset 4
      return buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      // ZIP signature (PK..)
      return startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06]);
    case "application/vnd.ms-excel":
    case "application/msword":
      // OLE Compound Document
      return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    default:
      // MIME pas dans la whitelist : déjà refusé en amont
      return false;
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "application/vnd.ms-excel":
      return ".xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return ".xlsx";
    case "application/msword":
      return ".doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    default:
      return "";
  }
}
