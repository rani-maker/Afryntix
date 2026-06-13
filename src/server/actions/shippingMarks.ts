"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsApp, receptionNoticeTemplate } from "@/lib/whatsapp";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

export async function upsertShippingMark(input: {
  name: string;
  phone: string;
  whatsapp?: string;
  notes?: string;
}) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name || !phone) return null;

  return prisma.shippingMark.upsert({
    where: { name_phone: { name, phone } },
    update: { whatsapp: input.whatsapp ?? undefined, notes: input.notes ?? undefined },
    create: { name, phone, whatsapp: input.whatsapp, notes: input.notes },
  });
}

export async function searchShippingMarks(query: string) {
  const q = query.trim();
  if (!q) return [];

  return prisma.shippingMark.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { shipments: true } },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
}

export async function getShippingMarkWithShipments(id: string) {
  return prisma.shippingMark.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: { envoi: { select: { id: true, reference: true, status: true } } },
      },
      factures: {
        orderBy: { createdAt: "desc" },
        include: { shipments: { select: { id: true, trackingNumber: true } } },
      },
    },
  });
}

export async function sendReceptionNotice(shippingMarkId: string): Promise<Result> {
  await requireRole("STAFF", "ADMIN");

  const mark = await prisma.shippingMark.findUnique({
    where: { id: shippingMarkId },
    include: {
      shipments: {
        where: { registrationNotifiedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          trackingNumber: true,
          description: true,
          mode: true,
          totalAmount: true,
          depositAmount: true,
          destinationCity: true,
        },
      },
    },
  });

  if (!mark) return { success: false, error: "Shipping mark introuvable." };
  if (mark.shipments.length === 0)
    return { success: false, error: "Aucun colis en attente de notification." };

  const phone = mark.whatsapp || mark.phone;
  const totalDeposit = mark.shipments.reduce((s, c) => s + c.depositAmount, 0);
  const totalAmount = mark.shipments.reduce((s, c) => s + c.totalAmount, 0);
  const destinationCity = mark.shipments.find((s) => s.destinationCity)?.destinationCity ?? undefined;

  await sendWhatsApp({
    to: phone,
    body: receptionNoticeTemplate({
      recipientName: mark.name,
      colis: mark.shipments.map((s) => ({
        trackingNumber: s.trackingNumber,
        description: s.description,
        mode: TRANSPORT_MODE_LABELS[s.mode],
        modeKey: s.mode,
        totalAmount: s.totalAmount,
        depositAmount: s.depositAmount,
        destinationCity: s.destinationCity,
      })),
      totalDeposit,
      totalAmount,
      destinationCity,
    }),
    template: "reception_notice",
    userId: mark.userId ?? undefined,
  });

  // Marquer tous ces colis comme notifiés
  await prisma.shipment.updateMany({
    where: { id: { in: mark.shipments.map((s) => s.id) } },
    data: { registrationNotifiedAt: new Date() },
  });

  revalidatePath("/staff/shipping-marks");
  revalidatePath(`/staff/shipping-marks/${shippingMarkId}`);
  return { success: true };
}

/**
 * Met à jour un shipping mark existant (édition côté staff).
 *
 * Couple `name + phone` est `@@unique` en DB : si on tente de renommer vers
 * une combinaison déjà prise par un autre mark, on retourne une erreur
 * explicite plutôt qu'une violation de contrainte cryptique.
 */
export async function updateShippingMark(input: {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  notes?: string;
}): Promise<Result> {
  await requireRole("STAFF", "ADMIN");

  const id = input.id.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!id) return { success: false, error: "Identifiant requis." };
  if (!name) return { success: false, error: "Nom requis." };
  if (!phone) return { success: false, error: "Téléphone requis." };

  const existing = await prisma.shippingMark.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Shipping mark introuvable." };

  // Conflit name+phone avec un autre mark ?
  if (name !== existing.name || phone !== existing.phone) {
    const conflict = await prisma.shippingMark.findUnique({
      where: { name_phone: { name, phone } },
    });
    if (conflict && conflict.id !== id) {
      return {
        success: false,
        error: `Un autre shipping mark existe déjà pour ${name} / ${phone}. Fusionne-les manuellement si c'est le même client.`,
      };
    }
  }

  await prisma.shippingMark.update({
    where: { id },
    data: {
      name,
      phone,
      whatsapp: input.whatsapp?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/staff/shipping-marks");
  revalidatePath(`/staff/shipping-marks/${id}`);
  return { success: true };
}

/**
 * Suppression d'un shipping mark — bloquée si la mark est référencée par
 * un colis ou une facture (préserve l'intégrité historique et comptable).
 * Si elle est liée à un compte (User), on autorise la suppression mais on
 * laisse le User intact (relation @unique sur ShippingMark.userId).
 */
export async function deleteShippingMark(id: string): Promise<Result> {
  await requireRole("STAFF", "ADMIN");

  const mark = await prisma.shippingMark.findUnique({
    where: { id },
    include: {
      _count: { select: { shipments: true, factures: true } },
    },
  });
  if (!mark) return { success: false, error: "Shipping mark introuvable." };

  if (mark._count.shipments > 0 || mark._count.factures > 0) {
    const parts: string[] = [];
    if (mark._count.shipments > 0) {
      parts.push(`${mark._count.shipments} colis`);
    }
    if (mark._count.factures > 0) {
      parts.push(`${mark._count.factures} facture${mark._count.factures > 1 ? "s" : ""}`);
    }
    return {
      success: false,
      error: `Suppression impossible : cette mark est rattachée à ${parts.join(" et ")}. Détache-les avant de supprimer.`,
    };
  }

  await prisma.shippingMark.delete({ where: { id } });

  revalidatePath("/staff/shipping-marks");
  return { success: true };
}

export async function linkShippingMarkToUser(input: {
  shippingMarkId: string;
  userId: string;
}): Promise<Result> {
  await requireRole("STAFF", "ADMIN");

  const existing = await prisma.shippingMark.findUnique({
    where: { userId: input.userId },
  });
  if (existing && existing.id !== input.shippingMarkId) {
    return { success: false, error: "Ce client est déjà lié à un autre shipping mark." };
  }

  await prisma.shippingMark.update({
    where: { id: input.shippingMarkId },
    data: { userId: input.userId },
  });

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  return { success: true };
}
