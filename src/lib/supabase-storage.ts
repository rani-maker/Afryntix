import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur uniquement (utilise la Service Role Key).
 * NE JAMAIS exposer ce client au client / au browser.
 */
let _client: SupabaseClient | null = null;

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.length > 0 ? v : undefined;
}

function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Configuration Supabase incomplète (variable(s) manquante(s) : ${missing}). ` +
        `Vérifiez .env.local (en dev, redémarrez le serveur après modification) ou les variables d'environnement de l'hébergeur (Render/Vercel).`,
    );
  }
  _client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

export const PARTNER_KYC_BUCKET = "partner-kyc";

/**
 * Upload un fichier dans le bucket partner-kyc à l'emplacement `path`.
 * Retourne le chemin (storage path) pour le stocker en DB.
 */
export async function uploadPartnerDocument(
  path: string,
  file: { buffer: ArrayBuffer | Uint8Array; contentType: string },
): Promise<string> {
  const client = getSupabaseAdmin();
  const { error } = await client.storage
    .from(PARTNER_KYC_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.contentType,
      upsert: true,
    });
  if (error) {
    throw new Error(`Upload Supabase échoué : ${error.message}`);
  }
  return path;
}

/**
 * Génère un lien signé temporaire (valide N secondes) pour consulter un document privé.
 */
export async function getSignedDocumentUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.storage
    .from(PARTNER_KYC_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Génération du lien signé échouée : ${error?.message ?? "inconnu"}`);
  }
  return data.signedUrl;
}

/**
 * Supprime un document du bucket.
 */
export async function deletePartnerDocument(path: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { error } = await client.storage.from(PARTNER_KYC_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Suppression échouée : ${error.message}`);
  }
}

/**
 * Construit le chemin de stockage canonique pour un document partenaire.
 * Format : partners/{partnerId}/{kind}-{timestamp}.{ext}
 */
export function buildPartnerDocPath(
  partnerId: string,
  kind: "id-document" | "contract-signed",
  originalFilename: string,
): string {
  const ext = originalFilename.split(".").pop()?.toLowerCase() ?? "bin";
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  return `partners/${partnerId}/${kind}-${Date.now()}.${safeExt}`;
}

// =============================================================
// Catalogues (PDF + images de couverture)
// Bucket privé : les fichiers sont servis via /api/catalogue/[id]/...
// (proxy same-origin : l'adresse Supabase n'est jamais exposée au visiteur).
// =============================================================

export const CATALOG_BUCKET = "catalogues";
export const CATALOG_PDF_MAX_BYTES = 320 * 1024 * 1024; // 320 Mo
export const CATALOG_COVER_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
export const CATALOG_COVER_MIME = ["image/jpeg", "image/png", "image/webp"];

let _catalogBucketReady = false;

async function ensureCatalogBucket(client: SupabaseClient): Promise<void> {
  if (_catalogBucketReady) return;
  // Pas de limite de taille propre au bucket : c'est la limite globale du projet
  // Supabase (Storage → Settings) qui s'applique. Elle doit être ≥ CATALOG_PDF_MAX_BYTES,
  // sinon Supabase refuse les gros PDF (413) quoi qu'autorise l'application.
  const options = {
    public: false,
    fileSizeLimit: null,
    allowedMimeTypes: ["application/pdf", ...CATALOG_COVER_MIME],
  };
  const { error } = await client.storage.createBucket(CATALOG_BUCKET, options);
  if (error) {
    if (!/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Création du bucket catalogues échouée : ${error.message}`);
    }
    // Bucket existant : on réaligne sa configuration (retire l'ancienne limite de 50 Mo)
    const { error: updateError } = await client.storage.updateBucket(CATALOG_BUCKET, options);
    if (updateError) {
      throw new Error(`Mise à jour du bucket catalogues échouée : ${updateError.message}`);
    }
  }
  _catalogBucketReady = true;
}

/**
 * Lien d'upload signé : le navigateur de l'admin envoie le fichier directement
 * à Supabase (les PDF dépassent la limite de taille des Server Actions).
 */
export async function createCatalogUploadUrl(path: string): Promise<string> {
  const client = getSupabaseAdmin();
  await ensureCatalogBucket(client);
  const { data, error } = await client.storage.from(CATALOG_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Préparation de l'upload échouée : ${error?.message ?? "inconnu"}`);
  }
  return data.signedUrl;
}

export async function getCatalogSignedUrl(path: string, expiresInSeconds = 600): Promise<string> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.storage.from(CATALOG_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Génération du lien signé échouée : ${error?.message ?? "inconnu"}`);
  }
  return data.signedUrl;
}

// Liens signés réutilisés par le proxy PDF : la visionneuse envoie de nombreuses
// requêtes partielles (Range) par catalogue, on évite un aller-retour de
// signature à chacune.
const STREAM_URL_TTL_SECONDS = 3600;
const STREAM_URL_REUSE_MS = 50 * 60 * 1000;
const _streamUrls = new Map<string, { url: string; reuseUntil: number }>();

async function getCatalogStreamUrl(path: string, forceNew = false): Promise<string> {
  const cached = _streamUrls.get(path);
  if (!forceNew && cached && cached.reuseUntil > Date.now()) return cached.url;
  const url = await getCatalogSignedUrl(path, STREAM_URL_TTL_SECONDS);
  _streamUrls.set(path, { url, reuseUntil: Date.now() + STREAM_URL_REUSE_MS });
  return url;
}

/**
 * Ouvre un flux de lecture sur un objet du bucket catalogues, en entier ou sur
 * une plage d'octets (`range` = valeur d'un en-tête HTTP Range). La réponse
 * Supabase (200 / 206 / 416) est renvoyée telle quelle, sans être mise en mémoire.
 */
export async function fetchCatalogObject(
  path: string,
  opts: { range?: string | null; signal?: AbortSignal } = {},
): Promise<Response> {
  const open = async (forceNew: boolean) =>
    fetch(await getCatalogStreamUrl(path, forceNew), {
      headers: {
        // Pas de compression : Content-Length doit refléter la taille réelle du PDF
        "Accept-Encoding": "identity",
        ...(opts.range ? { Range: opts.range } : {}),
      },
      cache: "no-store",
      signal: opts.signal,
    });

  // Coupure réseau ponctuelle vers le stockage (connexion réinitialisée…) : on réessaie
  const attempt = async (triesLeft: number, pauseMs: number): Promise<Response> => {
    try {
      return await open(false);
    } catch (e) {
      if (triesLeft <= 0 || opts.signal?.aborted) throw e;
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
      return attempt(triesLeft - 1, pauseMs * 3);
    }
  };

  let res = await attempt(3, 100);
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    // Lien signé périmé ou révoqué : on en génère un neuf et on réessaie une fois
    await res.body?.cancel().catch(() => {});
    res = await open(true);
  }
  return res;
}

export async function downloadCatalogObject(path: string): Promise<Blob> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.storage.from(CATALOG_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Téléchargement échoué : ${error?.message ?? "inconnu"}`);
  }
  return data;
}

export async function deleteCatalogObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const client = getSupabaseAdmin();
  const { error } = await client.storage.from(CATALOG_BUCKET).remove(paths);
  if (error) {
    throw new Error(`Suppression échouée : ${error.message}`);
  }
}
