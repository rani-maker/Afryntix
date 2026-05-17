"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import type { TransportMode } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const ScheduleSchema = z.object({
  mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
  departureDate: z.string().min(1),
  arrivalDate: z.string().optional(),
  cutoffDate: z.string().min(1),
  origin: z.string().min(1).default("Guangzhou"),
  destination: z.string().min(1),
  capacity: z.string().optional(),
  // Capacité numérique : CBM pour le maritime / storage, kg pour l'aérien,
  // unités pour véhicule / BTP. Float pour accepter 67.5 CBM, 1500.5 kg, etc.
  capacityValue: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

export async function createSchedule(input: unknown): Promise<Result<{ id: string }>> {
  await requireRole("ADMIN", "STAFF");
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const created = await prisma.shippingSchedule.create({
    data: {
      mode: parsed.data.mode as TransportMode,
      departureDate: new Date(parsed.data.departureDate),
      arrivalDate: parsed.data.arrivalDate ? new Date(parsed.data.arrivalDate) : null,
      cutoffDate: new Date(parsed.data.cutoffDate),
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      capacity: parsed.data.capacity,
      capacityValue: parsed.data.capacityValue ?? null,
      notes: parsed.data.notes,
    },
  });
  revalidatePath("/admin/schedules");
  revalidatePath("/staff/schedules");
  revalidatePath("/dashboard/reservations/new");
  return { success: true, data: { id: created.id } };
}

export async function toggleScheduleActive(input: { id: string; active: boolean }): Promise<Result> {
  await requireRole("ADMIN", "STAFF");
  await prisma.shippingSchedule.update({
    where: { id: input.id },
    data: { active: input.active },
  });
  revalidatePath("/admin/schedules");
  revalidatePath("/staff/schedules");
  return { success: true };
}

export async function deleteSchedule(input: { id: string }): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.shippingSchedule.delete({ where: { id: input.id } });
  revalidatePath("/admin/schedules");
  return { success: true };
}
