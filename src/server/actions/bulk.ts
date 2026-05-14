"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import type { ShipmentStatus } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const SHIPMENT_STATUSES = [
  "REGISTERED",
  "RECEIVED_CHINA",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "AVAILABLE_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const BulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(SHIPMENT_STATUSES),
  note: z.string().max(300).optional(),
  location: z.string().max(200).optional(),
});

/**
 * Change le statut de N colis en une opération.
 * Crée une entrée d'historique pour chaque colis et positionne `availableSinceAt` au passage en AVAILABLE_FOR_DELIVERY.
 */
export async function bulkUpdateShipmentStatus(input: unknown): Promise<Result<{ count: number }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = BulkStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const { ids, status, note, location } = parsed.data;
  const now = new Date();

  const toUpdate = await prisma.shipment.findMany({
    where: { id: { in: ids } },
    select: { id: true, availableSinceAt: true },
  });

  await prisma.$transaction(
    toUpdate.map((s) =>
      prisma.shipment.update({
        where: { id: s.id },
        data: {
          status: status as ShipmentStatus,
          ...(status === "AVAILABLE_FOR_DELIVERY" && !s.availableSinceAt
            ? { availableSinceAt: now }
            : {}),
          history: {
            create: {
              status: status as ShipmentStatus,
              note: note ?? "Mise à jour groupée",
              location,
              createdBy: session.user.id,
            },
          },
        },
      }),
    ),
  );

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");

  return { success: true, data: { count: toUpdate.length } };
}

const BulkAttachSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  envoiId: z.string().min(1).nullable(),
  containerId: z.string().min(1).optional().nullable(),
});

/**
 * Rattache (ou détache si envoiId=null) N colis à un envoi et optionnellement un container.
 */
export async function bulkAttachShipmentsToEnvoi(input: unknown): Promise<Result<{ count: number }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = BulkAttachSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const { ids, envoiId, containerId } = parsed.data;

  // Garde-fou : le mode du colis doit correspondre au mode de l'envoi
  if (envoiId) {
    const envoi = await prisma.envoi.findUnique({ where: { id: envoiId }, select: { mode: true } });
    if (!envoi) return { success: false, error: "Envoi introuvable." };
    const wrong = await prisma.shipment.count({ where: { id: { in: ids }, NOT: { mode: envoi.mode } } });
    if (wrong > 0) {
      return { success: false, error: `${wrong} colis ont un mode incompatible avec l'envoi.` };
    }
  }

  const res = await prisma.shipment.updateMany({
    where: { id: { in: ids } },
    data: {
      envoiId: envoiId ?? null,
      containerId: envoiId ? containerId ?? null : null,
    },
  });

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  if (envoiId) {
    revalidatePath(`/staff/envois/${envoiId}`);
    revalidatePath(`/admin/envois/${envoiId}`);
  }

  return { success: true, data: { count: res.count } };
}
