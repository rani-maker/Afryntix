import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// SMTP de la boîte de l'entreprise (Namecheap Private Email : mail.privateemail.com,
// port 465). Prioritaire sur Resend dès que SMTP_HOST / SMTP_USER / SMTP_PASSWORD
// sont renseignés. NB : l'offre gratuite de Render bloque les ports SMTP.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_ENABLED = !!(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

// En SMTP, l'expéditeur doit être la boîte authentifiée (sinon le serveur refuse).
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? (SMTP_ENABLED ? `AFRYNTIX <${SMTP_USER}>` : "AFRYNTIX <noreply@afryntix.com>");

let _smtp: Transporter | null = null;
function getSmtpTransport(): Transporter {
  if (!_smtp) {
    _smtp = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = SSL direct ; 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return _smtp;
}

/**
 * Boîte de l'équipe qui reçoit les bons de commande et une copie des devis.
 * Les réponses des clients aux emails de devis y arrivent aussi (reply-to).
 */
export const TEAM_EMAIL = process.env.ORDERS_NOTIFY_EMAIL || "infos@afryntix.com";

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
  /** Adresse à laquelle le destinataire répond (par défaut : l'expéditeur) */
  replyTo?: string;
};

/**
 * Envoie un email et le journalise dans Notification.
 * Transport : SMTP de la boîte de l'entreprise si configuré, sinon l'API Resend.
 * Sans aucune configuration, l'email est mis en QUEUED et un warning est loggé
 * (utile en dev : on garde la trace sans bloquer le flux).
 */
export async function sendEmail({ to, subject, html, text, template, userId, attachments, replyTo }: SendEmailArgs) {
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

  if (!SMTP_ENABLED && !RESEND_API_KEY) {
    console.warn(`[Email] ni SMTP ni RESEND_API_KEY configuré — notification ${notification.id} en attente.`);
    return notification;
  }

  try {
    const providerId = SMTP_ENABLED
      ? await sendViaSmtp({ to, subject, html, text, attachments, replyTo })
      : await sendViaResend({ to, subject, html, text, attachments, replyTo });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", providerId, sentAt: new Date() },
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

type OutgoingEmail = Pick<SendEmailArgs, "to" | "subject" | "html" | "text" | "attachments" | "replyTo">;

async function sendViaSmtp({ to, subject, html, text, attachments, replyTo }: OutgoingEmail): Promise<string | undefined> {
  const info = await getSmtpTransport().sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text: text ?? stripHtml(html),
    replyTo,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: "base64",
      contentType: a.contentType,
    })),
  });
  return info.messageId;
}

async function sendViaResend({ to, subject, html, text, attachments, replyTo }: OutgoingEmail): Promise<string | undefined> {
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
      ...(replyTo ? { reply_to: replyTo } : {}),
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
  return data.id;
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

export function emailCatalogQuote(args: {
  recipientName: string;
  reference: string;
  totalAmount: number;
  link: string;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] Votre devis — commande ${args.reference}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Bonjour ${escapeHtml(args.recipientName)},</h2>
      <p>Le devis de votre commande <strong>${escapeHtml(args.reference)}</strong> est prêt.</p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Montant du devis</td><td style="text-align: right;"><strong>${args.totalAmount.toLocaleString("fr-FR")} FCFA</strong></td></tr>
      </table>
      <p>Consultez le détail et validez-le depuis votre espace client :</p>
      <p><a href="${escapeHtml(args.link)}" style="display: inline-block; padding: 10px 18px; background: #0f172a; color: #ffffff; border-radius: 999px; text-decoration: none;">Voir mon devis</a></p>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— L'équipe AFRYNTIX</p>
    </div>`;
  return { subject, html };
}

/**
 * Email interne (équipe AFRYNTIX) sur une commande catalogue : bon de commande
 * reçu, copie du devis envoyé, devis accepté ou commande annulée.
 */
export function emailCatalogOrderTeam(args: {
  heading: string; // ex: "Nouveau bon de commande"
  reference: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  deliveryCity?: string | null;
  notes?: string | null;
  items?: Array<{
    catalogTitle: string;
    reference: string;
    designation: string;
    page?: string | null;
    quantity: number;
    unitPrice?: number | null;
    lineTotal?: number | null;
  }>;
  feesAmount?: number | null;
  totalAmount?: number | null;
  link: string;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] ${args.heading} — ${args.reference} (${args.clientName})`;
  const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
  const cell = "padding: 6px 8px; border: 1px solid #e2e8f0;";
  const priced = args.totalAmount != null;
  const rows = (args.items ?? [])
    .map(
      (i) => `
        <tr>
          <td style="${cell}"><strong>${escapeHtml(i.designation)}</strong><br><span style="color: #64748b;">Réf. ${escapeHtml(i.reference)}${i.page ? ` · p. ${escapeHtml(i.page)}` : ""} — ${escapeHtml(i.catalogTitle)}</span></td>
          <td style="${cell} text-align: right;">${i.quantity}</td>
          ${priced ? `<td style="${cell} text-align: right;">${i.unitPrice != null ? fcfa(i.unitPrice) : "—"}</td><td style="${cell} text-align: right;">${i.lineTotal != null ? fcfa(i.lineTotal) : "—"}</td>` : ""}
        </tr>`,
    )
    .join("");
  const contact = [args.clientEmail, args.clientPhone].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #0f172a;">${escapeHtml(args.heading)}</h2>
      <p>Commande <strong>${escapeHtml(args.reference)}</strong> — ${escapeHtml(args.clientName)}${contact ? `<br><span style="color: #64748b;">${contact}</span>` : ""}</p>
      ${args.deliveryCity ? `<p>Livraison : <strong>${escapeHtml(args.deliveryCity)}</strong></p>` : ""}
      ${
        rows
          ? `<table style="border-collapse: collapse; width: 100%; font-size: 13px;">
        <tr style="background: #f1f5f9;">
          <th style="${cell} text-align: left;">Article</th>
          <th style="${cell} text-align: right;">Qté</th>
          ${priced ? `<th style="${cell} text-align: right;">Prix unitaire</th><th style="${cell} text-align: right;">Total</th>` : ""}
        </tr>${rows}
        ${priced && args.feesAmount ? `<tr><td colspan="3" style="${cell} text-align: right;">Frais annexes</td><td style="${cell} text-align: right;">${fcfa(args.feesAmount)}</td></tr>` : ""}
        ${priced ? `<tr><td colspan="3" style="${cell} text-align: right;"><strong>Total du devis</strong></td><td style="${cell} text-align: right;"><strong>${fcfa(args.totalAmount ?? 0)}</strong></td></tr>` : ""}
      </table>`
          : priced
            ? `<p>Montant du devis : <strong>${fcfa(args.totalAmount ?? 0)}</strong></p>`
            : ""
      }
      ${args.notes ? `<p style="margin-top: 12px;"><strong>Message :</strong> ${escapeHtml(args.notes)}</p>` : ""}
      <p style="margin-top: 16px;"><a href="${escapeHtml(args.link)}" style="display: inline-block; padding: 10px 18px; background: #0f172a; color: #ffffff; border-radius: 999px; text-decoration: none;">Ouvrir la commande</a></p>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— Plateforme AFRYNTIX</p>
    </div>`;
  return { subject, html };
}

export function emailPasswordReset(args: {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; html: string } {
  const subject = `[AFRYNTIX] Réinitialisation de votre mot de passe`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Bonjour ${escapeHtml(args.recipientName)},</h2>
      <p>Vous avez demandé à réinitialiser votre mot de passe AFRYNTIX. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(args.resetUrl)}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">Réinitialiser mon mot de passe</a>
      </p>
      <p style="color: #64748b; font-size: 13px;">Ce lien est valable pendant <strong>${args.expiresInMinutes} minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe actuel reste inchangé.</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 12px; word-break: break-all;">Lien direct si le bouton ne fonctionne pas :<br/>${escapeHtml(args.resetUrl)}</p>
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
