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
}): string | null {
  const number = args.phone ? toWhatsAppNumber(args.phone) : null;
  if (!number) return null;
  const text = [
    `Bonjour ${args.name},`,
    "",
    args.totalAmount != null
      ? `Le devis de votre commande AFRYNTIX ${args.reference} est prêt : ${formatXOF(args.totalAmount)}.`
      : `Nous avons bien reçu votre demande AFRYNTIX ${args.reference}. Nous préparons votre devis.`,
    "",
    args.totalAmount != null
      ? `Consultez-le et validez-le ici : ${args.publicUrl}`
      : `Suivez votre demande ici : ${args.publicUrl}`,
    "",
    `AFRYNTIX — ${COMPANY.phone}`,
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Lien wa.me vers AFRYNTIX, pré-rempli avec la référence de la demande (côté client). */
export function buildCompanyWhatsAppUrl(reference: string): string | null {
  const number = toWhatsAppNumber(COMPANY.phone);
  if (!number) return null;
  const text = `Bonjour AFRYNTIX, je viens d'envoyer la demande de devis ${reference} depuis vos catalogues.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
