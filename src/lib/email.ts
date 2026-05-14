import { prisma } from "./prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "AFRYNTIX <noreply@afryntix.com>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  userId?: string;
};

/**
 * Envoie un email via Resend (https://resend.com) et journalise dans Notification.
 * Si RESEND_API_KEY n'est pas configuré, l'email est mis en QUEUED et un warning est loggé
 * (utile en dev : on garde la trace sans bloquer le flux).
 */
export async function sendEmail({ to, subject, html, text, template, userId }: SendEmailArgs) {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
