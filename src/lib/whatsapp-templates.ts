// Registre des templates WhatsApp approuvés par Meta.
// Chaque fonction retourne { contentSid, contentVariables } prêt à passer
// à sendWhatsApp({ twilioTemplate }).
//
// Si l'ENV correspondante est vide ou absente, retourne `undefined` → l'appel
// à sendWhatsApp retombe automatiquement sur le body freeform (fenêtre 24h).
// Permet un rollout progressif sans casser l'envoi existant.

export type TwilioTemplate = {
  contentSid: string;
  contentVariables: Record<string, string>;
};

function readSid(envKey: string): string | undefined {
  const v = process.env[envKey]?.trim();
  return v && v.length > 0 ? v : undefined;
}

// Meta rejette les variables vides — on force un espace insécable pour les champs optionnels.
function nonEmpty(s: string | null | undefined, fallback = " "): string {
  const v = (s ?? "").toString().trim();
  return v.length > 0 ? v : fallback;
}

// Format "570 000" (XOF sans décimales, séparateur de milliers français).
function formatInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

// ── Template 1 — afryntix_reception_notice ───────────────────
export function receptionNoticeTwilioTemplate(args: {
  recipientName: string;
  count: number;
  details: string;              // ex: "AFR-...001 (Air Express) / AFR-...002 (Sea LCL)"
  totalDeposit: number;
  totalAmount: number;
  firstTrackingNumber: string;  // pour l'URL du bouton
}): TwilioTemplate | undefined {
  const contentSid = readSid("TWILIO_TEMPLATE_RECEPTION_NOTICE_SID");
  if (!contentSid) return undefined;
  return {
    contentSid,
    contentVariables: {
      "1": nonEmpty(args.recipientName, "Cher client"),
      "2": String(args.count),
      "3": nonEmpty(args.details),
      "4": formatInt(args.totalDeposit),
      "5": formatInt(args.totalAmount),
      "6": nonEmpty(args.firstTrackingNumber),
    },
  };
}

// ── Template 2 — afryntix_shipment_available ─────────────────
export function shipmentAvailableTwilioTemplate(args: {
  recipientName: string;
  trackingNumber: string;
  factureReference: string;
  remainingAmount: number;
}): TwilioTemplate | undefined {
  const contentSid = readSid("TWILIO_TEMPLATE_SHIPMENT_AVAILABLE_SID");
  if (!contentSid) return undefined;
  return {
    contentSid,
    contentVariables: {
      "1": nonEmpty(args.recipientName, "Cher client"),
      "2": nonEmpty(args.trackingNumber),
      "3": nonEmpty(args.factureReference, "en cours"),
      "4": formatInt(args.remainingAmount),
      "5": nonEmpty(args.trackingNumber),
    },
  };
}

// ── Template 3 — afryntix_shipments_available_multi ──────────
export function shipmentsAvailableMultiTwilioTemplate(args: {
  recipientName: string;
  count: number;
  factureReference: string;
  trackingList: string;         // ex: "AFR-...001, AFR-...002, AFR-...003"
  totalAmount: number;
  remainingAmount: number;
}): TwilioTemplate | undefined {
  const contentSid = readSid("TWILIO_TEMPLATE_SHIPMENTS_AVAILABLE_MULTI_SID");
  if (!contentSid) return undefined;
  return {
    contentSid,
    contentVariables: {
      "1": nonEmpty(args.recipientName, "Cher client"),
      "2": String(args.count),
      "3": nonEmpty(args.factureReference),
      "4": nonEmpty(args.trackingList),
      "5": formatInt(args.totalAmount),
      "6": formatInt(args.remainingAmount),
      "7": nonEmpty(args.factureReference),
    },
  };
}

// ── Template 5 — afryntix_pickup_code ────────────────────────
export function pickupCodeTwilioTemplate(args: {
  recipientName: string;
  trackingNumber: string;
  code: string;
}): TwilioTemplate | undefined {
  const contentSid = readSid("TWILIO_TEMPLATE_PICKUP_CODE_SID");
  if (!contentSid) return undefined;
  return {
    contentSid,
    contentVariables: {
      "1": nonEmpty(args.recipientName, "Cher client"),
      "2": nonEmpty(args.trackingNumber),
      "3": nonEmpty(args.code),
    },
  };
}

// ── Template 7 — afryntix_reservation_validated ──────────────
// Le trackingNumber AFRYNTIX n'existe pas encore au moment de la validation
// de la réservation → on envoie un texte explicatif en {{3}}.
export function reservationValidatedTwilioTemplate(args: {
  clientName: string;
  reservationShortId: string;
}): TwilioTemplate | undefined {
  const contentSid = readSid("TWILIO_TEMPLATE_RESERVATION_VALIDATED_SID");
  if (!contentSid) return undefined;
  return {
    contentSid,
    contentVariables: {
      "1": nonEmpty(args.clientName, "Cher client"),
      "2": nonEmpty(args.reservationShortId),
      "3": "en attente de réception en Chine",
      "4": nonEmpty(args.reservationShortId),
    },
  };
}
