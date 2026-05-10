import { prisma } from "./prisma";
import { formatXOF, getAppUrl } from "./utils";

// =============================================================
// Provider actif : UltraMsg
// Twilio conservé en commentaire — voir section TWILIO ci-dessous
// =============================================================

// ── UltraMsg ──────────────────────────────────────────────────
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN    = process.env.ULTRAMSG_TOKEN;

function normalizePhone(phone: string): string {
  // Supprime espaces, tirets, parenthèses et le préfixe "whatsapp:"
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

  const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: ULTRAMSG_TOKEN,
      to: normalizePhone(to),
      body,
      priority: 10,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UltraMsg HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { sent?: string; id?: string; error?: string };

  if (data.error) {
    throw new Error(`UltraMsg erreur: ${data.error}`);
  }

  return data.id ?? "ultramsg-ok";
}

// ── Type commun ───────────────────────────────────────────────

type SendArgs = {
  to: string;
  body: string;
  template: string;
  userId?: string;
};

// ── Fonction principale ───────────────────────────────────────

export async function sendWhatsApp({ to, body, template, userId }: SendArgs) {
  // Log immédiat en DB — toujours, même si l'envoi échoue
  const notification = await prisma.notification.create({
    data: {
      userId,
      to,
      body,
      template,
      channel: "WHATSAPP",
      status: "QUEUED",
    },
  });

  if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN) {
    console.warn(
      `[WhatsApp] UltraMsg non configuré — notification ${notification.id} en attente.`,
      "Renseigner ULTRAMSG_INSTANCE_ID et ULTRAMSG_TOKEN dans .env.local",
    );
    return notification;
  }

  try {
    const providerId = await sendViaUltraMsg(to, body);

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        providerId,
        sentAt: new Date(),
      },
    });

    console.log(`[WhatsApp] ✅ Envoyé via UltraMsg — id: ${providerId}`);
    return notification;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] ❌ Erreur d'envoi UltraMsg:", errorMessage);

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        error: errorMessage,
      },
    });

    return notification;
  }
}

// =============================================================
// TWILIO — RÉSERVÉ POUR ACTIVATION ULTÉRIEURE
// Décommenter et reconfigurer quand le Business Profile Meta
// sera validé. Remplacer aussi l'appel sendViaUltraMsg() dans
// sendWhatsApp() par sendViaTwilio().
// =============================================================
//
// import twilio from "twilio";
//
// const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
// const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
// const TWILIO_FROM  = process.env.TWILIO_WHATSAPP_FROM; // "whatsapp:+15559138795"
//
// let twilioClient: twilio.Twilio | null = null;
// if (TWILIO_SID && TWILIO_TOKEN) {
//   twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
// }
//
// function normalizeTwilioPhone(phone: string): string {
//   const cleaned = phone.replace(/\s/g, "").replace(/[-()]/g, "");
//   if (cleaned.startsWith("whatsapp:")) return cleaned;
//   if (cleaned.startsWith("+")) return `whatsapp:${cleaned}`;
//   return `whatsapp:+${cleaned}`;
// }
//
// async function sendViaTwilio(to: string, body: string): Promise<string> {
//   if (!twilioClient || !TWILIO_FROM) {
//     throw new Error("Twilio non configuré.");
//   }
//   const msg = await twilioClient.messages.create({
//     from: TWILIO_FROM,
//     to: normalizeTwilioPhone(to),
//     body,
//   });
//   return msg.sid;
// }

// =============================================================
// Templates de messages
// =============================================================

type ShipmentCreatedArgs = {
  clientName: string;
  trackingNumber: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  mode: string;
};

export function shipmentCreatedTemplate(args: ShipmentCreatedArgs): string {
  return `🚢 *AFRYNTIX - Confirmation d'enregistrement*

Bonjour ${args.clientName},

Votre colis a été enregistré avec succès.

📦 *Numéro de suivi :* ${args.trackingNumber}
🚚 *Mode :* ${args.mode}

💰 *Tarification :*
• Montant total : ${formatXOF(args.totalAmount)}
• Acompte 50% : ${formatXOF(args.depositAmount)}
• Solde à la réception : ${formatXOF(args.remainingAmount)}

Suivez votre colis en temps réel sur :
${getAppUrl()}/tracking/${args.trackingNumber}

Merci de votre confiance.
*L'équipe AFRYNTIX*`;
}

export function shipmentAvailableTemplate(args: {
  clientName: string;
  trackingNumber: string;
  remainingAmount: number;
  pickupAddress?: string;
}): string {
  return `✅ *AFRYNTIX - Colis Disponible Pour Livraison*

Bonjour ${args.clientName},

Bonne nouvelle ! Votre colis *${args.trackingNumber}* est désormais *disponible pour livraison*.

💵 *Solde à régler :* ${formatXOF(args.remainingAmount)}

${args.pickupAddress ? `📍 *Adresse de retrait :*\n${args.pickupAddress}\n` : ""}
Merci de prendre contact avec nos équipes pour organiser la livraison.

*L'équipe AFRYNTIX*`;
}

export function withdrawalCodeTemplate(args: {
  clientName: string;
  reference: string;
  withdrawalCode: string;
  amount: number;
  currency: string;
  recipientName: string;
}): string {
  return `💳 *AFRYNTIX - Code de Retrait*

Bonjour ${args.clientName},

Votre opération de transfert a été initiée.

🔖 *Référence :* ${args.reference}
🔐 *Code de retrait :* *${args.withdrawalCode}*
💰 *Montant :* ${args.amount} ${args.currency}
👤 *Bénéficiaire :* ${args.recipientName}

🔎 Vérifiez le statut à tout moment :
${getAppUrl()}/withdraw/${args.withdrawalCode}

⚠️ *Conservez ce code confidentiellement.* Il sera demandé pour le retrait en Chine.

*L'équipe AFRYNTIX*`;
}

export function reservationValidatedTemplate(args: {
  clientName: string;
  reservationId: string;
  trackingNumber: string;
}): string {
  return `✅ *AFRYNTIX - Réservation Validée*

Bonjour ${args.clientName},

Votre réservation a été validée par notre équipe.

📦 *Numéro de suivi :* ${args.trackingNumber}

Vous pouvez désormais suivre votre colis dès qu'il sera réceptionné en Chine.

*L'équipe AFRYNTIX*`;
}
