"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { generateReference } from "@/lib/utils";
import { envoiStatusToShipmentStatus } from "@/lib/pricing";
import { revalidatePath } from "next/cache";
import type { TransportMode, EnvoiStatus, Carrier, ContainerType } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const TRANSPORT_MODES = [
  "AIR_EXPRESS",
  "AIR_NORMAL",
  "SEA_LCL",
  "SEA_FCL",
  "VEHICLE",
  "BTP_EQUIPMENT",
  "STORAGE",
] as const;

const ENVOI_STATUSES = [
  "PLANNED",
  "LOADING",
  "DEPARTED",
  "IN_TRANSIT",
  "ARRIVED",
  "CLEARED",
  "DELIVERED",
  "CANCELLED",
] as const;

const CARRIERS = [
  "MSC",
  "MAERSK",
  "CMA_CGM",
  "EVERGREEN",
  "COSCO",
  "HAPAG_LLOYD",
  "ONE",
  "AIR_FRANCE",
  "ETHIOPIAN",
  "EMIRATES",
  "TURKISH",
  "QATAR",
  "KENYA_AIRWAYS",
  "ROYAL_AIR_MAROC",
  "OTHER",
] as const;

const CONTAINER_TYPES = [
  "TWENTY_GP",
  "FORTY_GP",
  "FORTY_HQ",
  "FORTY_FIVE",
  "REEFER_20",
  "REEFER_40",
  "OPEN_TOP",
  "FLAT_RACK",
  "OTHER",
] as const;

// =============================================================
// Création d'un envoi
// =============================================================

const CreateEnvoiSchema = z.object({
  mode: z.enum(TRANSPORT_MODES),
  destination: z.string().min(2, "Destination requise"),
  origin: z.string().optional(),
  departureDate: z.string().optional(), // ISO date
  arrivalDate: z.string().optional(),
  carrier: z.enum(CARRIERS).optional().or(z.literal("")),
  bookingNumber: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  mawb: z.string().optional(),
  flightNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function createEnvoi(input: unknown): Promise<Result<{ id: string; reference: string }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = CreateEnvoiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Données invalides : " + parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  // Référence unique avec retry
  let reference = generateReference("ENV");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.envoi.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateReference("ENV");
  }

  const envoi = await prisma.envoi.create({
    data: {
      reference,
      mode: d.mode as TransportMode,
      origin: d.origin || "Guangzhou",
      destination: d.destination,
      departureDate: d.departureDate ? new Date(d.departureDate) : null,
      arrivalDate: d.arrivalDate ? new Date(d.arrivalDate) : null,
      carrier: d.carrier ? (d.carrier as Carrier) : null,
      bookingNumber: d.bookingNumber || null,
      vesselName: d.vesselName || null,
      voyageNumber: d.voyageNumber || null,
      mawb: d.mawb || null,
      flightNumber: d.flightNumber || null,
      notes: d.notes || null,
      createdById: session.user.id,
      history: {
        create: [{ status: "PLANNED", note: "Envoi créé", createdBy: session.user.id }],
      },
    },
  });

  revalidatePath("/staff/envois");
  return { success: true, data: { id: envoi.id, reference: envoi.reference } };
}

// =============================================================
// Mise à jour du statut d'un envoi (avec cascade optionnelle)
// =============================================================

const UpdateEnvoiStatusSchema = z.object({
  envoiId: z.string(),
  status: z.enum(ENVOI_STATUSES),
  note: z.string().optional(),
  cascadeToShipments: z.boolean().default(true),
});

export async function updateEnvoiStatus(input: unknown): Promise<Result<{ cascaded: number }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = UpdateEnvoiStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };

  const { envoiId, status, note, cascadeToShipments } = parsed.data;
  const envoi = await prisma.envoi.findUnique({
    where: { id: envoiId },
    include: { shipments: { select: { id: true, trackingNumber: true } } },
  });
  if (!envoi) return { success: false, error: "Envoi introuvable." };

  await prisma.envoi.update({
    where: { id: envoiId },
    data: {
      status: status as EnvoiStatus,
      history: {
        create: [{ status: status as EnvoiStatus, note: note || null, createdBy: session.user.id }],
      },
    },
  });

  let cascaded = 0;
  if (cascadeToShipments) {
    const childStatus = envoiStatusToShipmentStatus(status as EnvoiStatus);
    if (childStatus) {
      // Update + history pour chaque colis (Prisma ne supporte pas updateMany avec nested create)
      const ids = envoi.shipments.map((s) => s.id);
      if (ids.length > 0) {
        await prisma.$transaction([
          prisma.shipment.updateMany({
            where: { id: { in: ids } },
            data: { status: childStatus },
          }),
          prisma.shipmentHistory.createMany({
            data: ids.map((id) => ({
              shipmentId: id,
              status: childStatus,
              note: `Cascade depuis envoi ${envoi.reference}${note ? " — " + note : ""}`,
              createdBy: session.user.id,
            })),
          }),
        ]);
        cascaded = ids.length;
      }
    }
  }

  revalidatePath(`/staff/envois/${envoiId}`);
  revalidatePath("/staff/envois");
  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  return { success: true, data: { cascaded } };
}

// =============================================================
// Mise à jour des métadonnées (carrier, MAWB, vessel, etc.)
// =============================================================

const UpdateEnvoiMetaSchema = z.object({
  envoiId: z.string(),
  carrier: z.enum(CARRIERS).optional().or(z.literal("")),
  bookingNumber: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  mawb: z.string().optional(),
  flightNumber: z.string().optional(),
  departureDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateEnvoiMeta(input: unknown): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const parsed = UpdateEnvoiMetaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;

  await prisma.envoi.update({
    where: { id: d.envoiId },
    data: {
      carrier: d.carrier ? (d.carrier as Carrier) : null,
      bookingNumber: d.bookingNumber || null,
      vesselName: d.vesselName || null,
      voyageNumber: d.voyageNumber || null,
      mawb: d.mawb || null,
      flightNumber: d.flightNumber || null,
      departureDate: d.departureDate ? new Date(d.departureDate) : null,
      arrivalDate: d.arrivalDate ? new Date(d.arrivalDate) : null,
      notes: d.notes || null,
    },
  });

  revalidatePath(`/staff/envois/${d.envoiId}`);
  return { success: true };
}

// =============================================================
// Containers
// =============================================================

const AddContainerSchema = z.object({
  envoiId: z.string(),
  refInternal: z.string().min(2, "Référence interne requise"),
  type: z.enum(CONTAINER_TYPES).optional().or(z.literal("")),
  carrierNumber: z.string().optional(),
  sealNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function addContainer(input: unknown): Promise<Result<{ id: string }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = AddContainerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;

  // Vérifie unicité refInternal
  const existing = await prisma.container.findUnique({ where: { refInternal: d.refInternal } });
  if (existing) return { success: false, error: "Cette référence interne est déjà utilisée." };

  const c = await prisma.container.create({
    data: {
      envoiId: d.envoiId,
      refInternal: d.refInternal,
      type: d.type ? (d.type as ContainerType) : null,
      carrierNumber: d.carrierNumber || null,
      sealNumber: d.sealNumber || null,
      notes: d.notes || null,
    },
  });

  revalidatePath(`/staff/envois/${d.envoiId}`);
  return { success: true, data: { id: c.id } };
}

const UpdateContainerSchema = z.object({
  containerId: z.string(),
  carrierNumber: z.string().optional(),
  sealNumber: z.string().optional(),
  type: z.enum(CONTAINER_TYPES).optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function updateContainer(input: unknown): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const parsed = UpdateContainerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;

  const c = await prisma.container.update({
    where: { id: d.containerId },
    data: {
      carrierNumber: d.carrierNumber || null,
      sealNumber: d.sealNumber || null,
      type: d.type ? (d.type as ContainerType) : null,
      notes: d.notes || null,
    },
  });

  revalidatePath(`/staff/envois/${c.envoiId}`);
  return { success: true };
}

export async function deleteContainer(input: { containerId: string }): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const c = await prisma.container.findUnique({ where: { id: input.containerId } });
  if (!c) return { success: false, error: "Conteneur introuvable." };

  // Détache les colis (onDelete: SetNull sur Shipment.containerId est déjà géré par Prisma)
  await prisma.container.delete({ where: { id: input.containerId } });
  revalidatePath(`/staff/envois/${c.envoiId}`);
  return { success: true };
}

// =============================================================
// Rattachement de colis à un envoi (et optionnellement à un container)
// =============================================================

const AttachShipmentsSchema = z.object({
  envoiId: z.string(),
  shipmentIds: z.array(z.string()).min(1, "Sélectionner au moins un colis."),
  containerId: z.string().optional().or(z.literal("")),
});

export async function attachShipmentsToEnvoi(input: unknown): Promise<Result<{ count: number }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = AttachShipmentsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const { envoiId, shipmentIds, containerId } = parsed.data;

  const envoi = await prisma.envoi.findUnique({ where: { id: envoiId } });
  if (!envoi) return { success: false, error: "Envoi introuvable." };

  if (containerId) {
    const container = await prisma.container.findUnique({ where: { id: containerId } });
    if (!container || container.envoiId !== envoiId) {
      return { success: false, error: "Conteneur invalide pour cet envoi." };
    }
  }

  const r = await prisma.shipment.updateMany({
    where: { id: { in: shipmentIds } },
    data: { envoiId, containerId: containerId || null },
  });

  revalidatePath(`/staff/envois/${envoiId}`);
  revalidatePath("/staff/shipments");
  return { success: true, data: { count: r.count } };
}

export async function detachShipmentFromEnvoi(input: { shipmentId: string }): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const s = await prisma.shipment.findUnique({ where: { id: input.shipmentId } });
  if (!s) return { success: false, error: "Colis introuvable." };
  const envoiId = s.envoiId;

  await prisma.shipment.update({
    where: { id: input.shipmentId },
    data: { envoiId: null, containerId: null },
  });

  if (envoiId) revalidatePath(`/staff/envois/${envoiId}`);
  revalidatePath("/staff/shipments");
  return { success: true };
}
