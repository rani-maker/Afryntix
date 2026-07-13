import { prisma } from "./prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "AFRYNTIX <noreply@afryntix.com>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailAttachment = {
  filename: string;
  /** Contenu du fichier en base64 (sans préfixe `data:`) */
  content: string;
  contentType?: string;
};

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  userId?: string;
  attachments?: EmailAttachment[];
};

/**
 * Envoie un email via Resend (https://resend.com) et journalise dans Notification.
 * Si RESEND_API_KEY n'est pas configuré, l'email est mis en QUEUED et un warning est loggé
 * (utile en dev : on garde la trace sans bloquer le flux).
 */
export async function sendEmail({ to, subject, html, text, template, userId, attachments }: SendEmailArgs) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      to,
      body: `${subject}\n\n${text ?? stripHtml(html)}`,
      template,
      channel: "EMAIL",
      status: "QUEUED",
    },
  });

  if (!RESEND_API_KEY) {
    console.warn(`[Email] RESEND_API_KEY absent — notification ${notification.id} en attente.`);
    return notification;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        text: text ?? stripHtml(html),
        ...(attachments && attachments.length > 0
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as { id?: string };
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", providerId: data.id, sentAt: new Date() },
    });
    return notification;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Email] ❌", message);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: message },
    });
    return notification;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/* ============== Templates ============== */

export function emailShipmentAvailable(args: {
  recipientName: string;
  trackingNumber: string;
  totalAmount: number;
  remainingAmount: number;
  pickupAddress?: string;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] Votre colis ${args.trackingNumber} est disponible`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Bonjour ${escapeHtml(args.recipientName)},</h2>
      <p>Bonne nouvelle ! Votre colis <strong>${escapeHtml(args.trackingNumber)}</strong> est disponible pour retrait.</p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Total à régler</td><td style="text-align: right;"><strong>${args.totalAmount.toLocaleString("fr-FR")} FCFA</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Solde restant</td><td style="text-align: right; color: ${args.remainingAmount > 0 ? "#b45309" : "#16a34a"};"><strong>${args.remainingAmount.toLocaleString("fr-FR")} FCFA</strong></td></tr>
      </table>
      ${args.pickupAddress ? `<p>📍 Point de retrait : <strong>${escapeHtml(args.pickupAddress)}</strong></p>` : ""}
      <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— L'équipe AFRYNTIX</p>
    </div>`;
  return { subject, html };
}

export function emailPickupCode(args: {
  recipientName: string;
  trackingNumber: string;
  code: string;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] Code de retrait — ${args.trackingNumber}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Bonjour ${escapeHtml(args.recipientName)},</h2>
      <p>Votre code de retrait pour le colis <strong>${escapeHtml(args.trackingNumber)}</strong> :</p>
      <p style="text-align: center; font-size: 32px; font-family: monospace; letter-spacing: 6px; padding: 16px; background: #fef3c7; border-radius: 8px; color: #92400e;">${escapeHtml(args.code)}</p>
      <p>Présentez ce code et une pièce d'identité au point de retrait.</p>
      <p style="color: #b45309; font-size: 13px;">⚠️ Ne communiquez ce code à personne d'autre.</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— L'équipe AFRYNTIX</p>
    </div>`;
  return { subject, html };
}

export function emailPackingList(args: {
  recipientName: string;
  shippingMarkName: string;
  envoiReference: string;
  envoiMode: string;
  origin: string;
  destination: string;
  departureDate: Date | null;
  arrivalDate: Date | null;
  carrier: string | null;
  vesselOrFlight: string | null;
  containerLabel: string | null;
  totalPieces: number;
  totalWeightKg: number;
  totalCBM: number;
  packagesCount: number;
  printUrl?: string | null;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] Packing list ${args.envoiReference} — ${args.shippingMarkName}`;
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="color: #0f172a; margin-bottom: 4px;">Bonjour ${escapeHtml(args.recipientName)},</h2>
      <p style="margin-top: 0;">
        Votre marchandise (shipping mark <strong>${escapeHtml(args.shippingMarkName)}</strong>) a été
        chargée dans l'envoi <strong>${escapeHtml(args.envoiReference)}</strong>. Vous trouverez
        ci-joint votre <strong>packing list</strong> détaillé pour vos formalités de réception et de dédouanement.
      </p>

      <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #64748b;">Mode</td><td style="text-align: right;"><strong>${escapeHtml(args.envoiMode)}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Itinéraire</td><td style="text-align: right;"><strong>${escapeHtml(args.origin)} → ${escapeHtml(args.destination)}</strong></td></tr>
        ${args.carrier ? `<tr><td style="padding: 6px 0; color: #64748b;">Carrier</td><td style="text-align: right;">${escapeHtml(args.carrier)}</td></tr>` : ""}
        ${args.vesselOrFlight ? `<tr><td style="padding: 6px 0; color: #64748b;">Navire / Vol</td><td style="text-align: right;">${escapeHtml(args.vesselOrFlight)}</td></tr>` : ""}
        ${args.containerLabel ? `<tr><td style="padding: 6px 0; color: #64748b;">Container</td><td style="text-align: right;">${escapeHtml(args.containerLabel)}</td></tr>` : ""}
        <tr><td style="padding: 6px 0; color: #64748b;">Départ</td><td style="text-align: right;">${escapeHtml(fmtDate(args.departureDate))}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Arrivée prévue</td><td style="text-align: right;">${escapeHtml(fmtDate(args.arrivalDate))}</td></tr>
      </table>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Récapitulatif</div>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 6px;">
          <tr><td style="padding: 4px 0;">Colis</td><td style="text-align: right;"><strong>${args.packagesCount}</strong></td></tr>
          <tr><td style="padding: 4px 0;">Pièces totales</td><td style="text-align: right;"><strong>${args.totalPieces}</strong></td></tr>
          <tr><td style="padding: 4px 0;">Poids total</td><td style="text-align: right;"><strong>${args.totalWeightKg.toFixed(2)} kg</strong></td></tr>
          <tr><td style="padding: 4px 0;">Volume total</td><td style="text-align: right;"><strong>${args.totalCBM.toFixed(3)} CBM</strong></td></tr>
        </table>
      </div>

      ${args.printUrl ? `<p style="margin: 20px 0;"><a href="${escapeHtml(args.printUrl)}" style="display: inline-block; padding: 10px 18px; background: #0f172a; color: white; border-radius: 6px; text-decoration: none; font-weight: 600;">Voir le packing list en ligne</a></p>` : ""}

      <p style="color: #64748b; font-size: 13px;">
        Ce document est communiqué à titre informatif pour vos formalités de réception. Pour toute question,
        répondez directement à ce message.
      </p>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— L'équipe AFRYNTIX</p>
    </div>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
