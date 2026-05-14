"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, requireAuth, requireRole } from "@/auth";
import { notifyInApp } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import type { ClaimStatus, ClaimType } from "@prisma/client";
import { CLAIM_TYPES, CLAIM_STATUSES } from "@/lib/claims-labels";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

function generateClaimReference(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `AFR-CLM-${year}-${random}`;
}

const CreateSchema = z.object({
  shipmentId: z.string().min(1),
  type: z.enum(CLAIM_TYPES),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  amountClaimed: z.coerce.number().nonnegative().optional(),
});

export async function createClaim(input: unknown): Promise<Result<{ id: string; reference: string }>> {
  const session = await requireAuth();
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.data.shipmentId },
    select: { id: true, clientId: true, trackingNumber: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };

  // Un client ne peut ouvrir une réclamation que sur son propre colis
  if (session.user.role === "CLIENT" && shipment.clientId !== session.user.id) {
    return { success: false, error: "Vous n'êtes pas propriétaire de ce colis." };
  }

  let reference = generateClaimReference();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.claim.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateClaimReference();
  }

  const claim = await prisma.claim.create({
    data: {
      reference,
      shipmentId: shipment.id,
      type: parsed.data.type as ClaimType,
      title: parsed.data.title,
      description: parsed.data.description,
      amountClaimed: parsed.data.amountClaimed,
      openedById: session.user.id,
    },
  });

  // Notifier le client si c'est le staff qui ouvre, sinon notifier en interne
  if (shipment.clientId && session.user.id !== shipment.clientId) {
    await notifyInApp({
      userId: shipment.clientId,
      template: "claim_opened",
      title: "Réclamation ouverte",
      body: `Une réclamation a été ouverte sur ${shipment.trackingNumber} (${claim.reference}).`,
      link: `/dashboard/shipments`,
    });
  }

  revalidatePath(`/staff/shipments/${shipment.id}`);
  revalidatePath(`/admin/shipments/${shipment.id}`);
  revalidatePath(`/dashboard/shipments`);
  revalidatePath(`/staff/claims`);
  revalidatePath(`/admin/claims`);

  return { success: true, data: { id: claim.id, reference } };
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CLAIM_STATUSES).optional(),
  amountGranted: z.coerce.number().nonnegative().optional(),
  resolution: z.string().max(5000).optional(),
});

export async function updateClaim(input: unknown): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const claim = await prisma.claim.findUnique({
    where: { id: parsed.data.id },
    include: { shipment: { select: { id: true, clientId: true, trackingNumber: true } } },
  });
  if (!claim) return { success: false, error: "Réclamation introuvable." };

  const becomingResolved =
    parsed.data.status &&
    (parsed.data.status === "RESOLVED" || parsed.data.status === "REJECTED") &&
    claim.status !== parsed.data.status;

  await prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: parsed.data.status as ClaimStatus | undefined,
      amountGranted: parsed.data.amountGranted,
      resolution: parsed.data.resolution,
      ...(becomingResolved
        ? { resolvedAt: new Date(), resolvedById: session.user.id }
        : {}),
    },
  });

  if (becomingResolved && claim.shipment.clientId) {
    await notifyInApp({
      userId: claim.shipment.clientId,
      template: "claim_resolved",
      title: parsed.data.status === "RESOLVED" ? "Réclamation résolue ✓" : "Réclamation rejetée",
      body: `${claim.reference} (${claim.shipment.trackingNumber})`,
      link: `/dashboard/shipments`,
    });
  }

  revalidatePath(`/staff/shipments/${claim.shipment.id}`);
  revalidatePath(`/admin/shipments/${claim.shipment.id}`);
  revalidatePath(`/staff/claims`);
  revalidatePath(`/admin/claims`);

  return { success: true };
}
