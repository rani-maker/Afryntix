import { writeFile, mkdir, unlink } from "fs/promises";
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

function baseUploadDir() {
  return process.env.UPLOAD_DIR
    ? resolve(process.cwd(), process.env.UPLOAD_DIR)
    : join(process.cwd(), "public", "uploads");
}

export type DataUrl = `data:${string};base64,${string}`;

export type SavedFile = {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

/**
 * Sauvegarde un fichier encodé en base64 (format data URL ou simple base64)
 * dans le sous-dossier indiqué sous public/uploads/.
 * Retourne l'URL relative servie par Next et les métadonnées.
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
    url: `/uploads/${subfolder}/${fileName}`,
    fileName: safeOriginal ?? fileName,
    fileSize: buffer.byteLength,
    mimeType: mime,
  };
}

export async function deleteUploadedFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("/uploads/")) return;
  const rel = fileUrl.replace(/^\/uploads\//, "");
  const filepath = join(baseUploadDir(), rel);
  try {
    await unlink(filepath);
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
