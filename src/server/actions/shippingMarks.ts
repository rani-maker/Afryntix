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
