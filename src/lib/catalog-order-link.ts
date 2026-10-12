import { createHmac, timingSafeEqual } from "node:crypto";
import { COMPANY } from "./company";
import { toWhatsAppNumber } from "./facture-link";
import { formatXOF, getAppUrl } from "./utils";

// Lien public signé d'une commande catalogue : le demandeur sans compte suit sa
// demande, consulte son devis et y répond depuis /commande/[id]?k=… La signature
// (HMAC de l'id avec AUTH_SECRET) rend l'URL impossible à deviner.
export function getCatalogOrderSignature(orderId: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`catalog-order:${orderId}`).digest("hex").slice(0, 32);
}

export function verifyCatalogOrderSignature(orderId: string, signature: string | null | undefined): boolean {
  const expected = getCatalogOrderSignature(orderId);
  if (!expected || !signature || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function getCatalogOrderPublicPath(orderId: string): string | null {
  const signature = getCatalogOrderSignature(orderId);
  return signature ? `/commande/${orderId}?k=${signature}` : null;
}

export function getCatalogOrderPublicUrl(orderId: string): string | null {
  const path = getCatalogOrderPublicPath(orderId);
  return path ? `${getAppUrl()}${path}` : null;
}

/** Lien wa.me pour que l'équipe envoie au demandeur le lien de sa demande / de son devis. */
export function buildCatalogOrderWhatsAppUrl(args: {
  phone: string | null;
  name: string;
  reference: string;
  totalAmount: number | null;
  publicUrl: string;
  /** Commande passée aux prix affichés : déjà confirmée, rien à valider */
  direct?: boolean;
}): string | null {
  const number = args.phone ? toWhatsAppNumber(args.phone) : null;
  if (!number) return null;
  const message =
    args.direct && args.totalAmount != null
      ? [
          `Nous avons bien reçu votre commande AFRYNTIX ${args.reference} : ${formatXOF(args.totalAmount)} (articles, fret et dédouanement).`,
          `Suivez-la ici : ${args.publicUrl}`,
        ]
      : args.totalAmount != null
        ? [
            `Le devis de votre commande AFRYNTIX ${args.reference} est prêt : ${formatXOF(args.totalAmount)}.`,
            `Consultez-le et validez-le ici : ${args.publicUrl}`,
          ]
        : [
            `Nous avons bien reçu votre demande AFRYNTIX ${args.reference}. Nous préparons votre devis.`,
            `Suivez votre demande ici : ${args.publicUrl}`,
          ];
  const text = [`Bonjour ${args.name},`, "", message[0], "", message[1], "", `AFRYNTIX — ${COMPANY.phone}`].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Lien wa.me vers AFRYNTIX, pré-rempli avec la référence (côté client) : `order` pour une
 * commande passée aux prix affichés, `quote` pour une demande de devis, les deux pour un panier mixte.
 */
export function buildCompanyWhatsAppUrl(refs: { order?: string | null; quote?: string | null }): string | null {
  const number = toWhatsAppNumber(COMPANY.phone);
  if (!number) return null;
  const parts = [
    refs.order ? `de passer la commande ${refs.order} sur votre site` : null,
    refs.quote ? `d'envoyer la demande de devis ${refs.quote} depuis vos catalogues` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const text = `Bonjour AFRYNTIX, je viens ${parts.join(" et ")}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
