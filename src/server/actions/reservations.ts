"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, requireAuth, requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsApp, reservationValidatedTemplate } from "@/lib/whatsapp";
import { notifyInApp, inAppReservationValidated, inAppReservationRejected } from "@/lib/notifications";
import { saveBase64File } from "@/lib/storage";
import {
  computeOccupancy,
  reservationUsage,
  getCapacityUnit,
  CAPACITY_UNIT_LABEL,
} from "@/lib/schedule-capacity";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const ReservationSchema = z.object({
  mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
  category: z.enum(["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"]),
  description: z.string().optional(),
  estimatedWeightKg: z.coerce.number().nonnegative().optional(),
  estimatedVolumeCBM: z.coerce.number().nonnegative().optional(),
  supplierTrackingNumber: z.string().min(1, "Le numéro de suivi fournisseur est requis"),
  scheduleId: z.string().optional(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientAddress: z.string().optional(),
});

/**
 * Sauvegarde la photo de colis fournie par le client.
 *
 * Passe par `saveBase64File` qui :
 *  - whiteliste strictement les types image autorisés (JPEG/PNG/WEBP/HEIC) —
 *    le SVG est explicitement rejeté pour empêcher un stored XSS,
 *  - vérifie les magic bytes pour empêcher un exécutable déguisé en JPEG,
 *  - limite la taille à 15 Mo,
 *  - écrit hors de `public/` et renvoie une URL `/api/files/...` qui ne sera
 *    servie qu'aux utilisateurs authentifiés.
 */
async function savePhoto(photoBase64: string, reservationId: string): Promise<string> {
  const saved = await saveBase64File({
    base64: photoBase64,
    subfolder: "reservations",
    originalName: `reservation-${reservationId}.jpg`,
  });
  return saved.url;
}

export async function createReservation(
  input: Record<string, unknown> & { photoBase64?: string },
): Promise<Result<{ id: string }>> {
  const session = await requireAuth();
  const parsed = ReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  // Vérifie la capacité du calendrier si un scheduleId est fourni.
  // L'occupation est mesurée dans l'unité métier du mode (CBM en maritime,
  // kg en aérien, unités sinon). Voir lib/schedule-capacity.ts.
  if (parsed.data.scheduleId) {
    const schedule = await prisma.shippingSchedule.findUnique({
      where: { id: parsed.data.scheduleId },
      include: {
        reservations: {
          where: { status: { not: "REJECTED" } },
          select: { estimatedWeightKg: true, estimatedVolumeCBM: true },
        },
      },
    });
    if (!schedule) return { success: false, error: "Calendrier introuvable." };
    if (!schedule.active) return { success: false, error: "Ce calendrier n'est plus actif." };
    if (schedule.cutoffDate < new Date()) {
      return { success: false, error: "La date limite de réservation est dépassée." };
    }

    const occupancy = computeOccupancy(
      schedule.capacityValue,
      schedule.reservations,
      schedule.mode,
    );

    if (occupancy) {
      // L'ajout de cette réservation : on se base sur l'estimation fournie
      // (CBM pour maritime, kg pour aérien, sinon 1 unité).
      const newUsage = reservationUsage(
        {
          estimatedWeightKg: parsed.data.estimatedWeightKg ?? null,
          estimatedVolumeCBM: parsed.data.estimatedVolumeCBM ?? null,
        },
        schedule.mode,
      );

      if (occupancy.used + newUsage > occupancy.capacity) {
        // Cherche le prochain départ actif du même mode pour le suggérer.
        const next = await prisma.shippingSchedule.findFirst({
          where: {
            mode: schedule.mode,
            active: true,
            cutoffDate: { gte: new Date() },
            departureDate: { gt: schedule.departureDate },
          },
          orderBy: { departureDate: "asc" },
        });

        const unit = CAPACITY_UNIT_LABEL[getCapacityUnit(schedule.mode)];
        const tooBig = newUsage > 0 && occupancy.remaining > 0;
        const reason = occupancy.isFull
          ? `Ce départ est complet (${occupancy.used.toFixed(2)} / ${occupancy.capacity.toFixed(2)} ${unit}).`
          : tooBig
          ? `Cette réservation (${newUsage.toFixed(2)} ${unit}) dépasse la capacité restante (${occupancy.remaining.toFixed(2)} ${unit} disponibles).`
          : `Ce départ est complet.`;
        const suggestion = next
          ? ` Réservez sur le prochain départ : ${next.origin} → ${next.destination} le ${next.departureDate.toISOString().slice(0, 10)}.`
          : ` Aucun autre départ n'est encore programmé pour ce mode — l'équipe vous notifiera.`;
        return { success: false, error: reason + suggestion };
      }
    }
  }

  const reservation = await prisma.reservation.create({
    data: {
      clientId: session.user.id,
      mode: parsed.data.mode,
      category: parsed.data.category,
      description: parsed.data.description,
      estimatedWeightKg: parsed.data.estimatedWeightKg,
      estimatedVolumeCBM: parsed.data.estimatedVolumeCBM,
      supplierTrackingNumber: parsed.data.supplierTrackingNumber,
      scheduleId: parsed.data.scheduleId,
      recipientName: parsed.data.recipientName,
      recipientPhone: parsed.data.recipientPhone,
      recipientAddress: parsed.data.recipientAddress,
      status: "PENDING",
    },
  });

  // Sauvegarde photo si fournie
  const photoBase64 = (input as { photoBase64?: string }).photoBase64;
  if (photoBase64) {
    try {
      const photoUrl = await savePhoto(photoBase64, reservation.id);
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { photoUrl },
      });
    } catch (e: unknown) {
      console.warn("Erreur upload photo:", e);
    }
  }

  revalidatePath("/dashboard/reservations");
  revalidatePath("/staff/reservations");
  // Les compteurs « X / Y colis réservés » des calendriers doivent refléter
  // la nouvelle réservation côté admin, staff et portail client.
  revalidatePath("/dashboard/schedules");
  revalidatePath("/dashboard/reservations/new");
  revalidatePath("/staff/schedules");
  revalidatePath("/admin/schedules");
  return { success: true, data: { id: reservation.id } };
}

export async function validateReservation(input: { id: string }): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.id },
    include: { client: true },
  });
  if (!reservation) return { success: false, error: "Réservation introuvable." };
  if (reservation.status !== "PENDING") return { success: false, error: "Cette réservation a déjà été traitée." };

  await prisma.reservation.update({
    where: { id: input.id },
    data: {
      status: "VALIDATED",
      validatedById: session.user.id,
      validatedAt: new Date(),
    },
  });

  // Notification client (sans tracking number AFRYNTIX, qui sera créé à la réception)
  if (reservation.client.whatsapp || reservation.client.phone) {
    await sendWhatsApp({
      to: reservation.client.whatsapp || reservation.client.phone!,
      body: `✅ AFRYNTIX - Bonjour ${reservation.client.name},\n\nVotre réservation #${reservation.id.slice(0, 8).toUpperCase()} a été *validée* par notre équipe.\n\nNous attendons la réception de votre colis en Chine. Vous serez notifié dès qu'il arrivera.\n\nL'équipe AFRYNTIX`,
      template: "reservation_validated",
      userId: reservation.clientId,
    });
  }

  await notifyInApp({
    userId: reservation.clientId,
    template: "reservation_validated",
    ...inAppReservationValidated({ reservationShortId: reservation.id.slice(0, 8).toUpperCase() }),
  });

  revalidatePath("/staff/reservations");
  revalidatePath("/dashboard/reservations");
  return { success: true };
}

export async function rejectReservation(input: { id: string; reason: string }): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.id },
    include: { client: true },
  });
  if (!reservation) return { success: false, error: "Réservation introuvable." };

  await prisma.reservation.update({
    where: { id: input.id },
    data: {
      status: "REJECTED",
      rejectionReason: input.reason,
      validatedById: session.user.id,
      validatedAt: new Date(),
    },
  });

  if (reservation.client.whatsapp || reservation.client.phone) {
    await sendWhatsApp({
      to: reservation.client.whatsapp || reservation.client.phone!,
      body: `⚠️ AFRYNTIX - Bonjour ${reservation.client.name},\n\nVotre réservation #${reservation.id.slice(0, 8).toUpperCase()} a été refusée.\n\nMotif : ${input.reason}\n\nContactez-nous pour plus d'informations.\n\nL'équipe AFRYNTIX`,
      template: "reservation_rejected",
      userId: reservation.clientId,
    });
  }

  await notifyInApp({
    userId: reservation.clientId,
    template: "reservation_rejected",
    ...inAppReservationRejected({
      reservationShortId: reservation.id.slice(0, 8).toUpperCase(),
      reason: input.reason,
    }),
  });

  revalidatePath("/staff/reservations");
  revalidatePath("/dashboard/reservations");
  // Le rejet libère un slot dans la capacité du calendrier — les compteurs
  // affichés sur les pages calendrier doivent être rafraîchis.
  revalidatePath("/dashboard/schedules");
  revalidatePath("/dashboard/reservations/new");
  revalidatePath("/staff/schedules");
  revalidatePath("/admin/schedules");
  return { success: true };
}
