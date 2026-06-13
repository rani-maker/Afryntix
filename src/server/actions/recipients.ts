"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/auth";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const RecipientSchema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  phone: z.string().trim().min(1, "Téléphone requis"),
  whatsapp: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export async function listMyRecipients() {
  const session = await requireAuth();
  return prisma.recipient.findMany({
    where: { clientId: session.user.id, archived: false },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function listRecipientsForClient(clientId: string) {
  await requireRole("STAFF", "ADMIN");
  return prisma.recipient.findMany({
    where: { clientId, archived: false },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createRecipient(input: Record<string, unknown>): Promise<Result<{ id: string }>> {
  const session = await requireAuth();
  const parsed = RecipientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const isDefault = data.isDefault === true;

  const recipient = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.recipient.updateMany({
        where: { clientId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.recipient.create({
      data: {
        clientId: session.user.id,
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        notes: data.notes || null,
        isDefault,
      },
    });
  });

  revalidatePath("/dashboard/recipients");
  revalidatePath("/dashboard/reservations/new");
  return { success: true, data: { id: recipient.id } };
}

export async function updateRecipient(
  input: Record<string, unknown> & { id: string },
): Promise<Result> {
  const session = await requireAuth();
  const parsed = RecipientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const id = String(input.id).trim();
  if (!id) return { success: false, error: "Identifiant requis." };

  const existing = await prisma.recipient.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Destinataire introuvable." };
  if (existing.clientId !== session.user.id) {
    return { success: false, error: "Vous n'êtes pas autorisé à modifier ce destinataire." };
  }

  const data = parsed.data;
  const isDefault = data.isDefault === true;

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.recipient.updateMany({
        where: { clientId: session.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    await tx.recipient.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        notes: data.notes || null,
        isDefault,
      },
    });
  });

  revalidatePath("/dashboard/recipients");
  revalidatePath("/dashboard/reservations/new");
  return { success: true };
}

export async function deleteRecipient(id: string): Promise<Result> {
  const session = await requireAuth();
  const existing = await prisma.recipient.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Destinataire introuvable." };
  if (existing.clientId !== session.user.id) {
    return { success: false, error: "Vous n'êtes pas autorisé à supprimer ce destinataire." };
  }

  // Soft delete (archivé) pour ne pas casser l'historique des réservations.
  await prisma.recipient.update({ where: { id }, data: { archived: true, isDefault: false } });

  revalidatePath("/dashboard/recipients");
  revalidatePath("/dashboard/reservations/new");
  return { success: true };
}

export async function setDefaultRecipient(id: string): Promise<Result> {
  const session = await requireAuth();
  const existing = await prisma.recipient.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Destinataire introuvable." };
  if (existing.clientId !== session.user.id) {
    return { success: false, error: "Action non autorisée." };
  }

  await prisma.$transaction([
    prisma.recipient.updateMany({
      where: { clientId: session.user.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.recipient.update({ where: { id }, data: { isDefault: true, archived: false } }),
  ]);

  revalidatePath("/dashboard/recipients");
  revalidatePath("/dashboard/reservations/new");
  return { success: true };
}
