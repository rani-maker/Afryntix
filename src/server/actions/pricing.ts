"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import type { TransportMode, CargoCategory } from "@prisma/client";
import { DEFAULT_PRICING, type PricingGrid, type PricingCell } from "@/lib/pricing";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

/**
 * Construit la grille tarifaire effective : on part de `DEFAULT_PRICING`
 * (snapshot codé en dur) et on superpose les `PricingRule` actives stockées
 * en base de données. Le tarif dégressif `priceFrom5CBM` est exprimé par une
 * deuxième ligne avec `minQuantity = 5` pour le mode SEA_LCL.
 *
 * Cette grille est ensuite passée à `computePrice(input, { pricingGrid })`
 * — le moteur lui-même reste synchrone et pur.
 */
export async function getActivePricingGrid(): Promise<PricingGrid> {
  const rules = await prisma.pricingRule.findMany({
    where: { active: true },
    orderBy: { minQuantity: "asc" },
  });

  // Deep clone de la grille par défaut pour ne pas la muter.
  const grid: PricingGrid = JSON.parse(JSON.stringify(DEFAULT_PRICING)) as PricingGrid;

  for (const r of rules) {
    const cell: PricingCell = grid[r.mode]?.[r.category] ?? {
      unit: r.unit,
      price: r.pricePerUnit,
    };

    // Tarif dégressif LCL : ligne avec `minQuantity` (5 par convention)
    if (r.minQuantity != null && r.minQuantity > 0) {
      cell.priceFrom5CBM = r.pricePerUnit;
    } else {
      cell.price = r.pricePerUnit;
      cell.unit = r.unit;
    }

    if (!grid[r.mode]) grid[r.mode] = {};
    grid[r.mode]![r.category] = cell;
  }

  return grid;
}

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

/**
 * Supprime définitivement une règle tarifaire. Si l'admin veut juste
 * la désactiver temporairement, passer plutôt par `togglePricingRule`.
 *
 * NB : aucun colis n'est modifié rétroactivement — le `unitPrice` d'un
 * colis est figé à sa création. Cette suppression ne touche QUE les
 * futurs calculs de prix.
 */
export async function deletePricingRule(input: { id: string }): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.pricingRule.delete({ where: { id: input.id } });
  revalidatePath("/admin/pricing");
  return { success: true };
}
