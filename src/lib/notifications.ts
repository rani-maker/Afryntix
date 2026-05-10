import { prisma } from "./prisma";

type NotifyArgs = {
  userId: string;
  template: string;
  title: string;
  body: string;
  link?: string;
};

/**
 * Crée une notification in-app pour un client connecté.
 * À brancher en parallèle des envois WhatsApp côté staff/admin.
 */
export async function notifyInApp({ userId, template, title, body, link }: NotifyArgs) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        channel: "IN_APP",
        to: userId,
        template,
        title,
        body,
        link,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[notifyInApp] échec:", e);
    return null;
  }
}

// =============================================================
// Templates IN_APP — courts, formatés pour la cloche
// =============================================================

export function inAppShipmentCreated(args: { trackingNumber: string; mode: string }) {
  return {
    title: "Colis enregistré",
    body: `Votre colis ${args.trackingNumber} (${args.mode}) a été enregistré.`,
    link: `/dashboard/shipments`,
  };
}

export function inAppShipmentStatus(args: {
  trackingNumber: string;
  status: string;
  statusLabel: string;
}) {
  return {
    title: "Mise à jour de votre colis",
    body: `${args.trackingNumber} : ${args.statusLabel}.`,
    link: `/tracking/${args.trackingNumber}`,
  };
}

export function inAppShipmentAvailable(args: { trackingNumber: string }) {
  return {
    title: "Colis disponible pour livraison",
    body: `${args.trackingNumber} est prêt. Contactez nos équipes pour la livraison.`,
    link: `/tracking/${args.trackingNumber}`,
  };
}

export function inAppReservationValidated(args: { reservationShortId: string }) {
  return {
    title: "Réservation validée",
    body: `Votre réservation #${args.reservationShortId} a été validée.`,
    link: `/dashboard/reservations`,
  };
}

export function inAppReservationRejected(args: { reservationShortId: string; reason: string }) {
  return {
    title: "Réservation refusée",
    body: `Votre réservation #${args.reservationShortId} a été refusée. Motif : ${args.reason}`,
    link: `/dashboard/reservations`,
  };
}

export function inAppWithdrawalCode(args: { reference: string; withdrawalCode: string }) {
  return {
    title: "Code de retrait disponible",
    body: `Référence ${args.reference} — code ${args.withdrawalCode}.`,
    link: `/withdraw/${args.withdrawalCode}`,
  };
}

export function inAppPaymentCompleted(args: { reference: string }) {
  return {
    title: "Paiement finalisé",
    body: `L'opération ${args.reference} a été marquée comme terminée.`,
    link: `/dashboard`,
  };
}

export function inAppServiceUpdate(args: {
  reference: string;
  statusLabel: string;
}) {
  return {
    title: "Mise à jour de votre demande",
    body: `${args.reference} : ${args.statusLabel}.`,
    link: `/dashboard/services`,
  };
}
