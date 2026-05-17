/* eslint-disable no-console */
/**
 * Script de migration : déplace tous les fichiers historiques de
 * `public/uploads/` vers `private-uploads/` (ou `UPLOAD_DIR`) et réécrit
 * les URLs en base de `/uploads/...` vers `/api/files/...`.
 *
 * À exécuter UNE SEULE FOIS sur chaque environnement après déploiement
 * du correctif H1.
 *
 * Usage :
 *   npx tsx scripts/migrate-private-uploads.ts            # dry-run par défaut
 *   npx tsx scripts/migrate-private-uploads.ts --apply    # applique réellement
 *
 * Idempotent : ré-exécuter ne fera rien si tout est déjà migré.
 *
 * Tables touchées :
 *  - Document.fileUrl
 *  - Reservation.photoUrl
 *  - BillPayment.invoiceUrl
 *  - ShipmentPhoto.url
 */
import { PrismaClient } from "@prisma/client";
import { mkdir, rename, stat } from "fs/promises";
import { dirname, join, resolve } from "path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function baseUploadDir() {
  return process.env.UPLOAD_DIR
    ? resolve(process.cwd(), process.env.UPLOAD_DIR)
    : join(process.cwd(), "private-uploads");
}

function legacyDir() {
  return join(process.cwd(), "public", "uploads");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

async function moveFile(rel: string): Promise<"moved" | "missing" | "already"> {
  const from = join(legacyDir(), rel);
  const to = join(baseUploadDir(), rel);
  if (await fileExists(to)) return "already";
  if (!(await fileExists(from))) return "missing";
  if (APPLY) {
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }
  return "moved";
}

function rewriteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return url.replace(/^\/uploads\//, "/api/files/");
  return null;
}

type Counters = { rows: number; rewrites: number; moved: number; missing: number; already: number };

async function migrateTable<T extends { id: string }>(
  name: string,
  fetchAll: () => Promise<Array<T & Record<string, unknown>>>,
  field: string,
  update: (id: string, value: string) => Promise<unknown>,
  counters: Counters,
) {
  const rows = await fetchAll();
  for (const row of rows) {
    const current = row[field] as string | null | undefined;
    if (!current || !current.startsWith("/uploads/")) continue;
    counters.rows += 1;
    const rel = current.slice("/uploads/".length);
    const status = await moveFile(rel);
    counters[status] += 1;
    const newUrl = rewriteUrl(current);
    if (newUrl) {
      counters.rewrites += 1;
      if (APPLY) await update(row.id, newUrl);
    }
  }
  console.log(`  ${name}: ${rows.length} ligne(s) scannée(s)`);
}

async function main() {
  console.log(APPLY ? "🚚 Migration RÉELLE (--apply)" : "🔎 Dry-run (ajoutez --apply pour exécuter)");
  console.log(`  Source legacy : ${legacyDir()}`);
  console.log(`  Cible private : ${baseUploadDir()}`);

  const counters: Counters = { rows: 0, rewrites: 0, moved: 0, missing: 0, already: 0 };

  await migrateTable(
    "Document.fileUrl",
    () => prisma.document.findMany({ select: { id: true, fileUrl: true } }),
    "fileUrl",
    (id, value) => prisma.document.update({ where: { id }, data: { fileUrl: value } }),
    counters,
  );
  await migrateTable(
    "Reservation.photoUrl",
    () => prisma.reservation.findMany({ select: { id: true, photoUrl: true } }),
    "photoUrl",
    (id, value) => prisma.reservation.update({ where: { id }, data: { photoUrl: value } }),
    counters,
  );
  await migrateTable(
    "BillPayment.invoiceUrl",
    () => prisma.billPayment.findMany({ select: { id: true, invoiceUrl: true } }),
    "invoiceUrl",
    (id, value) => prisma.billPayment.update({ where: { id }, data: { invoiceUrl: value } }),
    counters,
  );
  await migrateTable(
    "ShipmentPhoto.url",
    () => prisma.shipmentPhoto.findMany({ select: { id: true, url: true } }),
    "url",
    (id, value) => prisma.shipmentPhoto.update({ where: { id }, data: { url: value } }),
    counters,
  );

  console.log("\n📊 Résumé :");
  console.log(`  Lignes avec URL legacy : ${counters.rows}`);
  console.log(`  URLs réécrites         : ${counters.rewrites}`);
  console.log(`  Fichiers déplacés      : ${counters.moved}`);
  console.log(`  Déjà dans la cible     : ${counters.already}`);
  console.log(`  Introuvables sur disque: ${counters.missing}`);

  if (!APPLY && counters.rewrites > 0) {
    console.log("\n⚠️  Aucune modification appliquée. Relancez avec --apply pour exécuter.");
  } else if (APPLY) {
    console.log("\n✅ Migration appliquée.");
    console.log("⚠️  Pensez à supprimer le contenu résiduel de public/uploads/ une fois la vérif faite.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
