"use server";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { prisma } from "@/lib/prisma";
import { auth, requireAuth, requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsApp, reservationValidatedTemplate } from "@/lib/whatsapp";
import { notifyInApp, inAppReservationValidated, inAppReservationRejected } from "@/lib/notifications";

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

async function savePhoto(photoBase64: string, reservationId: string): Promise<string> {
  // Format attendu : data:image/jpeg;base64,XXXX
  const match = photoBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error("Format de photo invalide");
  const ext = match[1].split("/")[1];
  const buffer = Buffer.from(match[2], "base64");
  // UPLOAD_DIR (relatif ou absolu) pointe sur la racine des uploads (ex: ./public/uploads).
  // Les photos de réservation vont systématiquement dans le sous-dossier "reservations/"
  // pour que l'URL servie par Next (/uploads/reservations/<file>) corresponde au chemin disque.
  const baseDir = process.env.UPLOAD_DIR
    ? resolve(process.cwd(), process.env.UPLOAD_DIR)
    : join(process.cwd(), "public", "uploads");
  const dir = join(baseDir, "reservations");
  await mkdir(dir, { recursive: true });
  const filename = `${reservationId}-${Date.now()}.${ext}`;
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);
  return `/uploads/reservations/${filename}`;
}

export async function createReservation(
  input: Record<string, unknown> & { photoBase64?: string },
): Promise<Result<{ id: string }>> {
  const session = await requireAuth();
  const parsed = ReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
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
  return { success: true };
}
