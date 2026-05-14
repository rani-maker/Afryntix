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
