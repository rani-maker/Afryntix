import { createHmac, timingSafeEqual } from "node:crypto";
import { COMPANY } from "./company";
import type { InvoiceDoc } from "./facture-document";
import { formatXOF, getAppUrl } from "./utils";

// Lien public signé : le client ouvre sa facture sans compte. La signature (HMAC de l'id
// avec AUTH_SECRET) rend l'URL impossible à deviner à partir d'une référence de facture.
function sign(factureId: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`facture:${factureId}`).digest("hex").slice(0, 32);
}

export function verifyFactureSignature(factureId: string, signature: string | undefined): boolean {
  const expected = sign(factureId);
  if (!expected || !signature || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function getFacturePublicUrl(factureId: string): string | null {
  const signature = sign(factureId);
  if (!signature) return null;
  return `${getAppUrl()}/facture/${factureId}?k=${signature}`;
}

// wa.me attend le numéro international sans « + ». Un numéro ivoirien saisi en local
// (10 chiffres commençant par 0) reçoit l'indicatif 225.
function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `225${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function buildFactureWhatsAppUrl(args: {
  phone: string | null;
  clientName: string;
  reference: string;
  envoiReference: string | null;
  packagesCount: number;
  totalAmount: number;
  remainingAmount: number;
  publicUrl: string;
}): string | null {
  const number = args.phone ? toWhatsAppNumber(args.phone) : null;
  if (!number) return null;
  const voyage = args.envoiReference ? ` (voyage ${args.envoiReference})` : "";
  const colis = `${args.packagesCount} colis`;
  const solde =
    args.remainingAmount > 0
      ? `Reste à payer : ${formatXOF(args.remainingAmount)}.`
      : "Cette facture est soldée. Merci !";
  const text = [
    `Bonjour ${args.clientName},`,
    "",
    `Voici votre facture AFRYNTIX n° ${args.reference}${voyage} — ${colis}.`,
    `Montant total : ${formatXOF(args.totalAmount)}.`,
    solde,
    "",
    `Consultez et téléchargez votre facture : ${args.publicUrl}`,
    "",
    `AFRYNTIX — ${COMPANY.phone}`,
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function getInvoiceShare(doc: InvoiceDoc): { publicUrl: string | null; whatsappUrl: string | null } {
  const publicUrl = getFacturePublicUrl(doc.id);
  if (!publicUrl) return { publicUrl: null, whatsappUrl: null };
  const whatsappUrl = buildFactureWhatsAppUrl({
    phone: doc.billTo.phone,
    clientName: doc.billTo.name,
    reference: doc.reference,
    envoiReference: doc.voyage?.reference ?? null,
    packagesCount: doc.lines.length,
    totalAmount: doc.totals.total,
    remainingAmount: doc.totals.remaining,
    publicUrl,
  });
  return { publicUrl, whatsappUrl };
}
