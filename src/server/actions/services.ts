"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, requireRole } from "@/auth";
import { generateReference } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ServiceType, ServiceRequestStatus } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const ServiceSchema = z.object({
  type: z.enum(["QUALITY_CONTROL", "PURCHASING", "VEHICLE_SALE", "BTP_SALE", "TRADING", "INTRODUCTION"]),
  clientName: z.string().min(2),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().min(6),
  message: z.string().min(5),
  budget: z.string().optional(),
});

export async function createServiceRequest(input: unknown): Promise<Result<{ reference: string }>> {
  const session = await auth();
  const parsed = ServiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  let reference = generateReference("SVC");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.serviceRequest.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateReference("SVC");
  }

  await prisma.serviceRequest.create({
    data: {
      reference,
      type: parsed.data.type as ServiceType,
      clientName: session?.user?.name ?? parsed.data.clientName,
      clientEmail: session?.user?.email ?? (parsed.data.clientEmail || null),
      clientPhone: parsed.data.clientPhone,
      message: parsed.data.message,
      budget: parsed.data.budget,
    },
  });
  revalidatePath("/admin/services");
  revalidatePath("/staff/services");
  return { success: true, data: { reference } };
}

export async function updateServiceStatus(input: {
  id: string;
  status: ServiceRequestStatus;
  notes?: string;
}): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  await prisma.serviceRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      notes: input.notes,
      handledById: session.user.id,
    },
  });
  revalidatePath("/admin/services");
  revalidatePath("/staff/services");
  return { success: true };
}
