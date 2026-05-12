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

function brandHeader(subject: string): string {
  return `*AFRYNTIX — ${subject}*`;
}
const BRAND_FOOTER = `━━━━━━━━━━━━━━━━━━━\nTél. Côte d'Ivoire : +225 07 06 26 04 05\nTél. Chine : +86 190 6650 0468\n_L'équipe AFRYNTIX_`;

function modeEmoji(modeKey: string): string {
  if (modeKey.startsWith("AIR")) return "✈️";
  if (modeKey.startsWith("SEA")) return "🚢";
  if (modeKey === "VEHICLE") return "🚗";
  if (modeKey === "BTP_EQUIPMENT") return "🏗️";
  if (modeKey === "STORAGE") return "🏭";
  return "📦";
}

// ── Avis de réception groupé (envoyé manuellement par le staff) ──────────────
type ReceptionColisArgs = {
  trackingNumber: string;
  description?: string | null;
  mode: string;
  modeKey: string;
  totalAmount: number;
  depositAmount: number;
  destinationCity?: string | null;
};

export function receptionNoticeTemplate(args: {
  recipientName: string;
  colis: ReceptionColisArgs[];
  totalDeposit: number;
  totalAmount: number;
  destinationCity?: string;
}): string {
  const appUrl = getAppUrl();
  const count = args.colis.length;
  const destLine = args.destinationCity ? `\nDestination : ${args.destinationCity}` : "";

  const colisLines = args.colis
    .map(
      (c, i) =>
        `📦 Colis ${i + 1} : \`${c.trackingNumber}\`\n` +
        `   ${modeEmoji(c.modeKey)} ${c.mode}${c.description ? ` — ${c.description}` : ""}\n` +
        `   Acompte : ${formatXOF(c.depositAmount)} · Total : ${formatXOF(c.totalAmount)}`,
    )
    .join("\n");

  const trackingLinks = args.colis
    .map((c) => `${appUrl}/tracking/${c.trackingNumber}`)
    .join("\n");

  return `${brandHeader(`Avis de réception — ${count} colis`)}
Bonjour *${args.recipientName}*,
*${count} colis* ont été reçus à notre entrepôt de Guangzhou et enregistrés à votre nom.${destLine}
━━━━━━━━━━━━━━━━━━━
${colisLines}
━━━━━━━━━━━━━━━━━━━
💰 Total acomptes à verser : *${formatXOF(args.totalDeposit)}*
   (50% du montant total de ${formatXOF(args.totalAmount)})
━━━━━━━━━━━━━━━━━━━
Veuillez procéder au règlement des acomptes dès que possible.
Contactez le Bureau d'Abidjan : +225 07 06 26 04 05
━━━━━━━━━━━━━━━━━━━
Suivre vos colis :
${trackingLinks}
${BRAND_FOOTER}`;
}

// ── Colis disponible (envoyé au DESTINATAIRE) ─────────────────
export function shipmentAvailableTemplate(args: {
  recipientName: string;
  trackingNumber: string;
  remainingAmount: number;
  totalAmount: number;
  depositPaid: boolean;
  pickupAddress?: string;
  destinationCity?: string;
  factureReference?: string;
  enTransit?: { trackingNumber: string; envoiReference?: string | null }[];
}): string {
  const appUrl = getAppUrl();
  const pickupLine = args.pickupAddress
    ? `\nAdresse de retrait : ${args.pickupAddress}`
    : args.destinationCity
    ? `\nVille : ${args.destinationCity}`
    : "";

  const paymentLine = args.depositPaid
    ? `💰 Solde à régler à la réception : *${formatXOF(args.remainingAmount)}*`
    : `⚠️ Acompte (50%) non encore reçu.\nMerci d'apporter la somme totale : *${formatXOF(args.totalAmount)}* lors du retrait.`;

  const factureLine = args.factureReference ? `\n📋 Facture : *${args.factureReference}*` : "";

  const transitSection =
    args.enTransit && args.enTransit.length > 0
      ? `\n━━━━━━━━━━━━━━━━━━━\nℹ️ ${args.enTransit.length} autre(s) colis en transit :\n` +
        args.enTransit
          .map((c) => `   • \`${c.trackingNumber}\`${c.envoiReference ? ` (${c.envoiReference})` : ""}`)
          .join("\n") +
        "\n   Vous serez notifié à leur arrivée."
      : "";

  return `${brandHeader("Disponibilité de votre colis")}
Bonjour *${args.recipientName}*,
Votre colis est arrivé et disponible pour livraison.
━━━━━━━━━━━━━━━━━━━
📦 N° de Suivi : \`${args.trackingNumber}\`${pickupLine}${factureLine}
${paymentLine}${transitSection}
━━━━━━━━━━━━━━━━━━━
Contactez-nous pour organiser votre livraison :
Bureau AFRYNTIX Abidjan — Angré Château
À 250 m du commissariat du 40ème Arr.
+225 07 06 26 04 05
━━━━━━━━━━━━━━━━━━━
Des frais de magasinage de 2 000 XOF/jour et 1 500 XOF/CBM seront ajoutés à la facture 3 jours après notification de disponibilité.
NB : Après 10 jours sans récupération, AFRYNTIX SARL n'est plus responsable de la maintenance et de la sécurité de votre colis.
━━━━━━━━━━━━━━━━━━━
Suivre le colis : ${appUrl}/tracking/${args.trackingNumber}
${BRAND_FOOTER}`;
}

// ── Plusieurs colis disponibles (même ShippingMark, envoyé au DESTINATAIRE) ─
export function shipmentsAvailableTemplate(args: {
  recipientName: string;
  colis: { trackingNumber: string; description?: string | null; mode: string; modeKey: string }[];
  factureReference: string;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  depositPaid: boolean;
  enTransit?: { trackingNumber: string; envoiReference?: string | null }[];
  destinationCity?: string;
}): string {
  const appUrl = getAppUrl();
  const count = args.colis.length;
  const colisLines = args.colis
    .map((c, i) => `📦 Colis ${i + 1} : \`${c.trackingNumber}\`${c.description ? ` — ${c.description}` : ""} (${modeEmoji(c.modeKey)} ${c.mode})`)
    .join("\n");

  const pickupLine = args.destinationCity ? `\nVille : ${args.destinationCity}` : "";

  const paymentLine = args.depositPaid
    ? `💰 Solde à régler à la réception : *${formatXOF(args.remainingAmount)}*`
    : `⚠️ Acompte (50%) non encore reçu.\nMerci d'apporter le montant total : *${formatXOF(args.totalAmount)}*`;

  const transitSection =
    args.enTransit && args.enTransit.length > 0
      ? `\nℹ️ ${args.enTransit.length} autre(s) colis en transit :\n` +
        args.enTransit
          .map((c) => `   • \`${c.trackingNumber}\`${c.envoiReference ? ` (${c.envoiReference})` : ""}`)
          .join("\n") +
        "\n   Vous serez notifié à leur arrivée avec leur facture."
      : "";

  const trackingLinks = args.colis
    .map((c) => `${appUrl}/tracking/${c.trackingNumber}`)
    .join("\n");

  return `${brandHeader(`Disponibilité de ${count} colis`)}
Bonjour *${args.recipientName}*,
*${count} colis* sont arrivés et disponibles pour livraison.${pickupLine}
━━━━━━━━━━━━━━━━━━━
${colisLines}
━━━━━━━━━━━━━━━━━━━
📋 Facture : *${args.factureReference}*
${paymentLine}${transitSection}
━━━━━━━━━━━━━━━━━━━
Contactez-nous pour organiser votre livraison :
Bureau AFRYNTIX Abidjan — Angré Château
À 250 m du commissariat du 40ème Arr.
+225 07 06 26 04 05
━━━━━━━━━━━━━━━━━━━
Des frais de magasinage de 2 000 XOF/jour et 1 500 XOF/CBM seront ajoutés 3 jours après cette notification.
━━━━━━━━━━━━━━━━━━━
Suivre vos colis :
${trackingLinks}
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

  return `${brandHeader("Mise à jour de votre expédition")}

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

  return `${brandHeader("Code de retrait")}

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
  return `${brandHeader("Réservation validée")}

Bonjour *${args.clientName}*,

✅ *Votre réservation a été validée par notre équipe.*

━━━━━━━━━━━━━━━━━━━
📦 *N° de suivi :* \`${args.trackingNumber}\`
━━━━━━━━━━━━━━━━━━━

Votre colis sera suivi dès sa réception en Chine. Nous vous notifierons à chaque étape.
${BRAND_FOOTER}`;
}
