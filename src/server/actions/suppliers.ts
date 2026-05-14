"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/auth";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(160),
  contactPerson: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  wechat: z.string().max(80).optional(),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().max(80).optional(),
  address: z.string().max(300).optional(),
  alibabaUrl: z.string().max(300).optional(),
  category: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Crée ou met à jour un fournisseur du client connecté.
 * Staff/admin peuvent passer `clientId` explicite via une variante (non implémentée ici pour cadrage).
 */
export async function upsertSupplier(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireAuth();
  const parsed = SupplierSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;

  let row;
  if (d.id) {
    const existing = await prisma.supplier.findUnique({ where: { id: d.id }, select: { clientId: true } });
    if (!existing) return { success: false, error: "Fournisseur introuvable." };
    if (existing.clientId !== session.user.id && session.user.role === "CLIENT") {
      return { success: false, error: "Vous n'êtes pas propriétaire de ce fournisseur." };
    }
    row = await prisma.supplier.update({
      where: { id: d.id },
      data: {
        name: d.name,
        contactPerson: d.contactPerson || null,
        phone: d.phone || null,
        whatsapp: d.whatsapp || null,
        wechat: d.wechat || null,
        email: d.email || null,
        city: d.city || null,
        address: d.address || null,
        alibabaUrl: d.alibabaUrl || null,
        category: d.category || null,
        notes: d.notes || null,
      },
    });
  } else {
    row = await prisma.supplier.create({
      data: {
        clientId: session.user.id,
        name: d.name,
        contactPerson: d.contactPerson || null,
        phone: d.phone || null,
        whatsapp: d.whatsapp || null,
        wechat: d.wechat || null,
        email: d.email || null,
        city: d.city || null,
        address: d.address || null,
        alibabaUrl: d.alibabaUrl || null,
        category: d.category || null,
        notes: d.notes || null,
      },
    });
  }

  revalidatePath("/dashboard/suppliers");
  return { success: true, data: { id: row.id } };
}

export async function deleteSupplier(id: string): Promise<Result> {
  const session = await requireAuth();
  const row = await prisma.supplier.findUnique({ where: { id }, select: { clientId: true } });
  if (!row) return { success: false, error: "Fournisseur introuvable." };
  if (row.clientId !== session.user.id && session.user.role === "CLIENT") {
    return { success: false, error: "Non autorisé." };
  }
  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}
