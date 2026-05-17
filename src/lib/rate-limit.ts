/**
 * Rate-limiter in-memory à fenêtre glissante (sliding window).
 *
 * ⚠️ Limitations :
 *  - L'état vit dans la mémoire du process. En multi-instance (load-balancer,
 *    Render auto-scale), chaque instance a son propre compteur — la borne
 *    réelle est donc `limit × N_instances`. Suffisant pour bloquer un
 *    brute-force naïf, pas pour un attaquant distribué.
 *  - Pour un usage plus strict, remplacer par Redis / Upstash.
 *
 * Le helper utilise un nettoyage paresseux : à chaque appel, on filtre les
 * timestamps hors fenêtre. Pas de timer global → pas de fuite.
 */

type Bucket = number[]; // timestamps en ms, triés croissants

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * @param key       Identifiant logique du bucket (ex: `login:bob@x.com|1.2.3.4`).
 * @param limit     Nombre max d'appels autorisés dans la fenêtre.
 * @param windowMs  Durée de la fenêtre (en ms).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? [];
  // Filtre paresseusement les timestamps trop vieux.
  let start = 0;
  while (start < bucket.length && bucket[start] < cutoff) start += 1;
  const recent = start === 0 ? bucket : bucket.slice(start);

  if (recent.length >= limit) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, recent);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

/**
 * Récupère l'IP source à partir des headers usuels.
 * Render / Vercel posent `x-forwarded-for` (premier IP = client réel).
 */
export function ipFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
