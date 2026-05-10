"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import type { TransportMode, CargoCategory } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const PricingSchema = z.object({
  mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
  category: z.enum(["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"]),
  unit: z.string().min(1),
  pricePerUnit: z.coerce.number().nonnegative(),
  minQuantity: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
});

export async function upsertPricingRule(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = PricingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const mode = parsed.data.mode as TransportMode;
  const category = parsed.data.category as CargoCategory;
  const minQuantity = parsed.data.minQuantity ?? null;

  // PostgreSQL traite NULL comme distinct dans une contrainte UNIQUE composée,
  // donc on ne peut pas utiliser upsert directement quand minQuantity est null.
  const existing = await prisma.pricingRule.findFirst({
    where: {
      mode,
      category,
      unit: parsed.data.unit,
      minQuantity,
    },
  });

  if (existing) {
    await prisma.pricingRule.update({
      where: { id: existing.id },
      data: {
        pricePerUnit: parsed.data.pricePerUnit,
        description: parsed.data.description,
        active: true,
      },
    });
  } else {
    await prisma.pricingRule.create({
      data: {
        mode,
        category,
        unit: parsed.data.unit,
        pricePerUnit: parsed.data.pricePerUnit,
        minQuantity: parsed.data.minQuantity,
        description: parsed.data.description,
      },
    });
  }

  revalidatePath("/admin/pricing");
  return { success: true };
}

export async function togglePricingRule(input: { id: string; active: boolean }): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.pricingRule.update({
    where: { id: input.id },
    data: { active: input.active },
  });
  revalidatePath("/admin/pricing");
  return { success: true };
}
