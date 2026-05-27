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
