import type { NextConfig } from "next";

/**
 * Headers de sécurité globaux. Voir https://owasp.org/www-project-secure-headers/
 *
 * Choix maison :
 *  - `Strict-Transport-Security` : HSTS 1 an, sous-domaines inclus. Suppose
 *    qu'on est SERVI en HTTPS partout (le cas sur Render).
 *  - `Content-Security-Policy` : aussi strict que possible sans casser
 *    Next/React. `unsafe-inline` reste nécessaire sur `script-src` pour les
 *    bundles inlined par Next ; `style-src` aussi pour Tailwind/JIT.
 *    À durcir plus tard via nonces si on veut passer en `strict-dynamic`.
 *  - `Referrer-Policy: strict-origin-when-cross-origin` : standard moderne.
 *  - `Permissions-Policy` : on coupe les capteurs/sensors non utilisés.
 *  - `X-Frame-Options: DENY` : pas d'embed tiers.
 *  - `X-Content-Type-Options: nosniff` : empêche le sniffing MIME.
 */
/**
 * Origines Supabase autorisées en `connect-src` (upload direct des catalogues).
 *
 * Ces en-têtes sont figés AU BUILD : sur Render (build Docker), les variables
 * d'environnement du service ne sont pas disponibles à ce moment-là. On autorise
 * donc toujours `*.supabase.co`, et on ajoute l'origine exacte si elle est connue
 * (utile pour un domaine Supabase personnalisé).
 */
function supabaseConnectSources(): string {
  const sources = ["https://*.supabase.co"];
  try {
    const origin = new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/^["']|["']$/g, "")).origin;
    if (!origin.endsWith(".supabase.co")) sources.push(origin);
  } catch {
    // variable absente au build : le joker suffit
  }
  return sources.join(" ");
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next inline `<script>` et hydratation : 'unsafe-inline' indispensable
      // tant qu'on n'a pas un middleware à nonces.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind JIT en dev + styles inline générés par next/image.
      "style-src 'self' 'unsafe-inline'",
      // Tuiles cartographiques (Leaflet + CARTO basemaps via CDN) — sans cela
      // la carte de suivi ne charge aucune tuile (conteneur vide).
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org",
      "font-src 'self' data:",
      // Connexions XHR/fetch/WebSocket : self (Twilio/Resend tournent côté
      // serveur) + Supabase Storage pour l'upload direct des catalogues PDF
      // par l'admin (lien signé, voir requestCatalogUpload).
      `connect-src 'self' ${supabaseConnectSources()}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

/**
 * `remotePatterns` restreint.
 *
 * Avant : `hostname: "**"` → un attaquant pouvait forcer le serveur Next à
 * faire un GET vers n'importe quel host via `/_next/image?url=https://...`,
 * ce qui permet du SSRF (scan interne) et de la fuite d'IP origine.
 *
 * On limite ici aux hôtes effectivement nécessaires :
 *  - aucun par défaut (les uploads sont servis via `/api/files/...`, donc en local)
 *  - hôtes additionnels ajoutables via `NEXT_IMAGE_REMOTE_HOSTS` (CSV)
 */
function parseRemoteHosts(): { protocol: "https"; hostname: string }[] {
  const csv = process.env.NEXT_IMAGE_REMOTE_HOSTS ?? "";
  return csv
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((hostname) => ({ protocol: "https" as const, hostname }));
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Force la racine de file-tracing au répertoire du projet pour silencer
  // l'avertissement « multiple lockfiles » quand le projet vit dans un
  // worktree imbriqué (le parent peut contenir un autre package-lock.json
  // appartenant à une autre checkout — Next prendrait le mauvais).
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: parseRemoteHosts(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
