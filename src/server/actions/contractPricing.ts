"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { TransportMode, CargoCategory } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const MODES = ["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"] as const;
const CATS = ["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"] as const;

const CreateSchema = z.object({
  clientId: z.string().min(1),
  mode: z.enum(MODES),
  category: z.enum(CATS),
  unit: z.enum(["kg", "pcs", "cbm", "vehicle"]),
  pricePerUnit: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export async function upsertClientPricing(input: unknown): Promise<Result<{ id: string }>> {
  await requireRole("ADMIN");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const row = await prisma.clientPricingRule.upsert({
    where: {
      clientId_mode_category_unit: {
        clientId: parsed.data.clientId,
        mode: parsed.data.mode as TransportMode,
        category: parsed.data.category as CargoCategory,
        unit: parsed.data.unit,
      },
    },
    update: {
      pricePerUnit: parsed.data.pricePerUnit,
      notes: parsed.data.notes,
      active: true,
    },
    create: {
      clientId: parsed.data.clientId,
      mode: parsed.data.mode as TransportMode,
      category: parsed.data.category as CargoCategory,
      unit: parsed.data.unit,
      pricePerUnit: parsed.data.pricePerUnit,
      notes: parsed.data.notes,
      active: true,
    },
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { success: true, data: { id: row.id } };
}

export async function deleteClientPricing(id: string): Promise<Result> {
  await requireRole("ADMIN");
  const row = await prisma.clientPricingRule.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Tarif client introuvable." };
  await prisma.clientPricingRule.delete({ where: { id } });
  revalidatePath(`/admin/clients/${row.clientId}`);
  return { success: true };
}

/**
 * Recherche un prix contractuel actif pour le triplet client/mode/catégorie/unité.
 * Retourne null si aucun tarif personnalisé n'est en vigueur.
 *
 * Sécurité : exposé comme Server Action (fichier `"use server"`). On exige STAFF/ADMIN
 * pour empêcher un attaquant anonyme ou un client tiers d'énumérer les tarifs négociés.
 */
export async function getClientContractPrice(opts: {
  clientId: string | null | undefined;
  mode: TransportMode;
  category: CargoCategory;
  unit: string;
}): Promise<number | null> {
  await requireRole("STAFF", "ADMIN");
  if (!opts.clientId) return null;
  const now = new Date();
  const row = await prisma.clientPricingRule.findFirst({
    where: {
      clientId: opts.clientId,
      mode: opts.mode,
      category: opts.category,
      unit: opts.unit,
      active: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  return row?.pricePerUnit ?? null;
}
