"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import type { AddressType } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const AddressSchema = z.object({
  type: z.enum(["AIR_WAREHOUSE", "SEA_WAREHOUSE", "RECEPTION", "OFFICE"]),
  label: z.string().min(2),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  line1: z.string().min(2),
  line2: z.string().optional(),
  city: z.string().min(2),
  country: z.string().min(2),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
});

export async function createAddress(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = AddressSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  await prisma.companyAddress.create({
    data: { ...parsed.data, type: parsed.data.type as AddressType },
  });
  revalidatePath("/admin/addresses");
  revalidatePath("/addresses");
  revalidatePath("/dashboard/addresses");
  return { success: true };
}

export async function toggleAddress(input: { id: string; active: boolean }): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.companyAddress.update({
    where: { id: input.id },
    data: { active: input.active },
  });
  revalidatePath("/admin/addresses");
  revalidatePath("/addresses");
  return { success: true };
}

export async function deleteAddress(input: { id: string }): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.companyAddress.delete({ where: { id: input.id } });
  revalidatePath("/admin/addresses");
  revalidatePath("/addresses");
  return { success: true };
}
