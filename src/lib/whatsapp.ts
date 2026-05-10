import { prisma } from "./prisma";
import { formatXOF, getAppUrl } from "./utils";

// =============================================================
// Provider actif : UltraMsg
// =============================================================

const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN    = process.env.ULTRAMSG_TOKEN;

function normalizePhone(phone: string): string {
  const cleaned = phone
    .replace(/\s/g, "")
    .replace(/[-()]/g, "")
    .replace(/^whatsapp:/i, "");
  if (cleaned.startsWith("+")) return cleaned;
  return `+${cleaned}`;
}

async function sendViaUltraMsg(to: string, body: string): Promise<string> {
  if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN) {
    throw new Error("ULTRAMSG_INSTANCE_ID ou ULTRAMSG_TOKEN non défini.");
  }

  const res = await fetch(
    `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: ULTRAMSG_TOKEN,
        to: normalizePhone(to),
        body,
        priority: 10,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UltraMsg HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { sent?: string; id?: string; error?: string };
  if (data.error) throw new Error(`UltraMsg erreur: ${data.error}`);
  return data.id ?? "ultramsg-ok";
}

type SendArgs = {
  to: string;
  body: string;
  template: string;
  userId?: string;
};

export async function sendWhatsApp({ to, body, template, userId }: SendArgs) {
  const notification = await prisma.notification.create({
    data: { userId, to, body, template, channel: "WHATSAPP", status: "QUEUED" },
  });

  if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN) {
    console.warn(
      `[WhatsApp] UltraMsg non configuré — notification ${notification.id} en attente.`
    );
    return notification;
  }

  try {
    const providerId = await sendViaUltraMsg(to, body);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", providerId, sentAt: new Date() },
    });
    console.log(`[WhatsApp] ✅ Envoyé — id: ${providerId}`);
    return notification;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] ❌ Erreur UltraMsg:", errorMessage);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: errorMessage },
    });
    return notification;
  }
}

// =============================================================
// Templates de messages
// =============================================================

const BRAND_HEADER = `🟢 *AFRYNTIX* — Transport & Logistique Chine 🇨🇳 ↔ Afrique 🌍`;
const BRAND_FOOTER = `\n━━━━━━━━━━━━━━━━━━━\n📞 Côte d'Ivoire : +225 07 06 26 04 05\n📞 Chine : +86 190 6650 0468\n_L'équipe AFRYNTIX_`;

// ── Colis enregistré (envoyé au CLIENT expéditeur) ────────────
type ShipmentCreatedArgs = {
  clientName: string;
  trackingNumber: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  mode: string;
  recipientName?: string;
  recipientPhone?: string;
  destinationCity?: string;
};

export function shipmentCreatedTemplate(args: ShipmentCreatedArgs): string {
  const appUrl = getAppUrl();
  const destinationLine = args.destinationCity
    ? `\n📍 *Destination :* ${args.destinationCity}`
    : "";
  const recipientLine =
    args.recipientName
      ? `\n👤 *Destinataire :* ${args.recipientName}${args.recipientPhone ? ` (${args.recipientPhone})` : ""}`
      : "";

  return `${BRAND_HEADER}

Bonjour *${args.clientName}*,

✅ Votre colis a été *enregistré avec succès* dans notre système.

━━━━━━━━━━━━━━━━━━━
📦 *N° de suivi :* \`${args.trackingNumber}\`
🚚 *Mode :* ${args.mode}${destinationLine}${recipientLine}

💰 *Tarification :*
• Total : *${formatXOF(args.totalAmount)}*
• Acompte (50%) : ${formatXOF(args.depositAmount)}
• Solde à la réception : ${formatXOF(args.remainingAmount)}
━━━━━━━━━━━━━━━━━━━

⚠️ *Veuillez procéder au paiement de votre acompte de 50% si ce n'est pas encore fait.*
📲 Voir AFRYNTIX Abidjan : *+225 07 06 26 04 05*
━━━━━━━━━━━━━━━━━━━

🔍 *Suivez votre colis en temps réel :*
${appUrl}/tracking/${args.trackingNumber}
${BRAND_FOOTER}`;
}

// ── Colis disponible (envoyé au DESTINATAIRE) ─────────────────
export function shipmentAvailableTemplate(args: {
  recipientName: string;
  trackingNumber: string;
  remainingAmount: number;
  pickupAddress?: string;
  destinationCity?: string;
}): string {
  const appUrl = getAppUrl();
  const pickupLine = args.pickupAddress
    ? `\n📍 *Adresse de retrait :*\n${args.pickupAddress}`
    : args.destinationCity
    ? `\n📍 *Ville :* ${args.destinationCity}`
    : "";

  return `${BRAND_HEADER}

Bonjour *${args.recipientName}*,

🎉 *Votre colis est arrivé et disponible pour livraison !*

━━━━━━━━━━━━━━━━━━━
📦 *N° de suivi :* \`${args.trackingNumber}\`${pickupLine}
💵 *Solde à régler :* *${formatXOF(args.remainingAmount)}*
━━━━━━━━━━━━━━━━━━━

📲 *Contactez-nous pour organiser votre livraison.*

🔍 Suivre le colis :
${appUrl}/tracking/${args.trackingNumber}
${BRAND_FOOTER}`;
}

// ── Notification de statut générique (envoyé au CLIENT) ───────
export function shipmentStatusTemplate(args: {
  clientName: string;
  trackingNumber: string;
  statusLabel: string;
  statusIcon: string;
  location?: string;
  note?: string;
}): string {
  const appUrl = getAppUrl();
  const locationLine = args.location ? `\n📍 *Localisation :* ${args.location}` : "";
  const noteLine = args.note ? `\n💬 ${args.note}` : "";

  return `${BRAND_HEADER}

Bonjour *${args.clientName}*,

${args.statusIcon} *Mise à jour de votre colis*

━━━━━━━━━━━━━━━━━━━
📦 *N° de suivi :* \`${args.trackingNumber}\`
🔄 *Statut :* ${args.statusLabel}${locationLine}${noteLine}
━━━━━━━━━━━━━━━━━━━

🔍 Suivre en temps réel :
${appUrl}/tracking/${args.trackingNumber}
${BRAND_FOOTER}`;
}

// ── Code de retrait (envoyé au CLIENT) ────────────────────────
export function withdrawalCodeTemplate(args: {
  clientName: string;
  reference: string;
  withdrawalCode: string;
  amount: number;
  currency: string;
  recipientName: string;
}): string {
  const appUrl = getAppUrl();

  return `${BRAND_HEADER}

Bonjour *${args.clientName}*,

💳 *Votre opération de transfert est initiée.*

━━━━━━━━━━━━━━━━━━━
🔖 *Référence :* \`${args.reference}\`
🔐 *Code de retrait :* *${args.withdrawalCode}*
💰 *Montant :* ${args.amount} ${args.currency}
👤 *Bénéficiaire :* ${args.recipientName}
━━━━━━━━━━━━━━━━━━━

🔎 Vérifier le statut :
${appUrl}/withdraw/${args.withdrawalCode}

⚠️ *Partagez ce code uniquement avec le bénéficiaire.* Il sera exigé pour le retrait en Chine.
${BRAND_FOOTER}`;
}

// ── Réservation validée (envoyé au CLIENT) ────────────────────
export function reservationValidatedTemplate(args: {
  clientName: string;
  reservationId: string;
  trackingNumber: string;
}): string {
  return `${BRAND_HEADER}

Bonjour *${args.clientName}*,

✅ *Votre réservation a été validée par notre équipe.*

━━━━━━━━━━━━━━━━━━━
📦 *N° de suivi :* \`${args.trackingNumber}\`
━━━━━━━━━━━━━━━━━━━

Votre colis sera suivi dès sa réception en Chine. Nous vous notifierons à chaque étape.
${BRAND_FOOTER}`;
}
