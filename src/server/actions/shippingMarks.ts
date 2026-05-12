"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";

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
