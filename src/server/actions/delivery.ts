"use server";
import { z } from "zod";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail, emailPickupCode } from "@/lib/email";
import { notifyInApp } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

/** Durée de validité d'un code de retrait (7 jours). Au-delà, il faut en regénérer un. */
const PICKUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Comparaison de codes en temps constant pour éviter une attaque par timing.
 * Pour 6 chiffres c'est largement théorique, mais c'est gratuit.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const GenerateSchema = z.object({
  shipmentId: z.string().min(1),
  notifyClient: z.coerce.boolean().default(true),
});

/**
 * Génère un code de retrait unique pour un colis disponible.
 * Le code est envoyé au client par WhatsApp (si configuré).
 */
export async function generatePickupCode(input: unknown): Promise<Result<{ code: string }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = GenerateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.data.shipmentId },
    include: { client: true, shippingMark: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (shipment.status === "DELIVERED") return { success: false, error: "Colis déjà livré." };
  if (shipment.status !== "AVAILABLE_FOR_DELIVERY") {
    return { success: false, error: "Le colis n'est pas encore disponible pour livraison." };
  }

  // Générer un code unique (vérification après chaque tirage, et garantie finale)
  let code = "";
  let ok = false;
  for (let i = 0; i < 15; i++) {
    code = generateCode();
    const exists = await prisma.shipment.findFirst({
      where: { pickupCode: code },
      select: { id: true },
    });
    if (!exists) { ok = true; break; }
  }
  if (!ok) {
    return { success: false, error: "Impossible de générer un code unique, réessayez." };
  }

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      pickupCode: code,
      pickupCodeIssuedAt: new Date(),
      history: {
        create: {
          status: shipment.status,
          note: `Code de retrait généré (${code.slice(0, 1)}*****)`,
        },
      },
    },
  });

  if (parsed.data.notifyClient) {
    const recipientPhone =
      shipment.recipientPhone ||
      shipment.client?.whatsapp ||
      shipment.client?.phone ||
      shipment.clientPhone ||
      null;
    const recipientName =
      shipment.recipientName ||
      shipment.shippingMark?.name ||
      shipment.client?.name ||
      shipment.clientName ||
      "Cher client";
    if (recipientPhone) {
      const body = `🔐 AFRYNTIX - ${recipientName}\n\nVoici votre *code de retrait* pour le colis ${shipment.trackingNumber} :\n\n*${code}*\n\nPrésentez ce code et une pièce d'identité au point de retrait pour récupérer votre marchandise.\n\nNe communiquez ce code à personne d'autre.`;
      await sendWhatsApp({
        to: recipientPhone,
        body,
        template: "pickup_code",
        userId: shipment.clientId ?? undefined,
      });
    }
    // Email parallèle si on a l'adresse client
    if (shipment.client?.email) {
      const tpl = emailPickupCode({
        recipientName,
        trackingNumber: shipment.trackingNumber,
        code,
      });
      await sendEmail({
        to: shipment.client.email,
        subject: tpl.subject,
        html: tpl.html,
        template: "pickup_code",
        userId: shipment.clientId ?? undefined,
      });
    }
    if (shipment.clientId) {
      await notifyInApp({
        userId: shipment.clientId,
        template: "pickup_code",
        title: "Code de retrait disponible",
        body: `Code de retrait pour ${shipment.trackingNumber} : ${code}`,
        link: `/dashboard/shipments`,
      });
    }
  }

  revalidatePath(`/staff/shipments/${shipment.id}`);
  revalidatePath(`/admin/shipments/${shipment.id}`);

  return { success: true, data: { code } };
}

const DeliverSchema = z.object({
  shipmentId: z.string().min(1),
  code: z.string().min(4).max(10),
  deliveredToName: z.string().min(2).max(120),
  deliveredToPhone: z.string().max(40).optional(),
  deliveredToIdNumber: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
});

/**
 * Valide la remise du colis au client.
 * - Vérifie le code de retrait
 * - Capture l'identité du présent (nom, téléphone, pièce ID)
 * - Transitionne en DELIVERED
 */
export async function markDelivered(input: unknown): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = DeliverSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.data.shipmentId },
    include: { client: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (shipment.status === "DELIVERED") return { success: false, error: "Colis déjà livré." };
  if (!shipment.pickupCode || !shipment.pickupCodeIssuedAt) {
    return { success: false, error: "Aucun code de retrait généré pour ce colis." };
  }
  // Expiration : un code de retrait n'est valide que pendant PICKUP_CODE_TTL_MS.
  // Au-delà, on force la regénération (audit trail + nouveau code communiqué).
  const age = Date.now() - shipment.pickupCodeIssuedAt.getTime();
  if (age > PICKUP_CODE_TTL_MS) {
    return {
      success: false,
      error: "Le code de retrait a expiré. Regénérez un nouveau code.",
    };
  }
  if (!constantTimeEqual(shipment.pickupCode, parsed.data.code.trim())) {
    return { success: false, error: "Code de retrait incorrect." };
  }

  const now = new Date();
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "DELIVERED",
      deliveredAt: now,
      deliveredToName: parsed.data.deliveredToName,
      deliveredToPhone: parsed.data.deliveredToPhone,
      deliveredToIdNumber: parsed.data.deliveredToIdNumber,
      deliveredById: session.user.id,
      // Sécurité : invalide le code une fois utilisé (one-shot)
      pickupCode: null,
      pickupCodeIssuedAt: null,
      history: {
        create: {
          status: "DELIVERED",
          note:
            `Remis à ${parsed.data.deliveredToName}` +
            (parsed.data.deliveredToIdNumber ? ` (pièce ${parsed.data.deliveredToIdNumber})` : "") +
            (parsed.data.note ? ` — ${parsed.data.note}` : ""),
          createdBy: session.user.id,
        },
      },
    },
  });

  if (shipment.clientId) {
    await notifyInApp({
      userId: shipment.clientId,
      template: "shipment_delivered",
      title: "Colis livré ✓",
      body: `${shipment.trackingNumber} a été remis à ${parsed.data.deliveredToName}.`,
      link: `/dashboard/shipments`,
    });
  }

  revalidatePath(`/staff/shipments/${shipment.id}`);
  revalidatePath(`/admin/shipments/${shipment.id}`);
  revalidatePath(`/tracking/${shipment.trackingNumber}`);

  return { success: true };
}
