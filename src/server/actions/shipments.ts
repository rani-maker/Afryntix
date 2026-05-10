"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, auth } from "@/auth";
import { generateTrackingNumber } from "@/lib/utils";
import { computePrice, trackingPrefix, TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { sendWhatsApp, shipmentCreatedTemplate, shipmentAvailableTemplate } from "@/lib/whatsapp";
import {
  notifyInApp,
  inAppShipmentCreated,
  inAppShipmentAvailable,
  inAppShipmentStatus,
} from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import type { TransportMode, CargoCategory, ShipmentStatus } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const CreateShipmentSchema = z
  .object({
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    clientPhone: z.string().optional(),
    mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
    category: z.enum(["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"]),
    description: z.string().optional(),
    pieces: z.coerce.number().int().min(1).default(1),
    weightKg: z.coerce.number().nonnegative().optional(),
    lengthCm: z.coerce.number().nonnegative().optional(),
    widthCm: z.coerce.number().nonnegative().optional(),
    heightCm: z.coerce.number().nonnegative().optional(),
    volumeCBM: z.coerce.number().nonnegative().optional(),
    destinationCity: z.string().optional(),
    destinationCountry: z.string().optional(),
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    recipientAddress: z.string().optional(),
    overrideUnitPrice: z.coerce.number().nonnegative().optional(),
    reservationId: z.string().optional(),
    envoiId: z.string().optional(),
    containerId: z.string().optional(),
  })
  .refine((d) => !!d.clientId || (!!d.clientName && d.clientName.trim().length > 0), {
    message: "Sélectionnez un client enregistré ou saisissez le nom du client.",
    path: ["clientName"],
  });

export async function createShipment(input: unknown): Promise<Result<{ trackingNumber: string; id: string }>> {
  await requireRole("STAFF", "ADMIN");
  const parsed = CreateShipmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides : " + parsed.error.issues.map((i) => i.message).join(", ") };

  const data = parsed.data;
  const client = data.clientId
    ? await prisma.user.findUnique({ where: { id: data.clientId } })
    : null;
  if (data.clientId && !client) return { success: false, error: "Client introuvable." };

  let pricing;
  try {
    pricing = computePrice({
      mode: data.mode as TransportMode,
      category: data.category as CargoCategory,
      pieces: data.pieces,
      weightKg: data.weightKg,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      volumeCBM: data.volumeCBM,
      overrideUnitPrice: data.overrideUnitPrice,
    });
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur de calcul." };
  }

  // Génération du tracking number (avec retry sur conflit)
  let trackingNumber = generateTrackingNumber(trackingPrefix(data.mode as TransportMode));
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!exists) break;
    trackingNumber = generateTrackingNumber(trackingPrefix(data.mode as TransportMode));
  }

  const chargeableWeight = pricing.unit === "kg" ? pricing.chargeableQuantity : undefined;

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      clientId: data.clientId || null,
      clientName: data.clientId ? null : data.clientName,
      clientPhone: data.clientId ? null : data.clientPhone,
      mode: data.mode as TransportMode,
      category: data.category as CargoCategory,
      description: data.description,
      pieces: data.pieces,
      weightKg: data.weightKg,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      volumeCBM: data.volumeCBM ?? pricing.cbm,
      volumetricWeight: pricing.volumetricWeight,
      chargeableWeight,
      destinationCity: data.destinationCity,
      destinationCountry: data.destinationCountry,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      recipientAddress: data.recipientAddress,
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      depositAmount: pricing.depositAmount,
      remainingAmount: pricing.remainingAmount,
      reservationId: data.reservationId,
      envoiId: data.envoiId || null,
      containerId: data.containerId || null,
      history: {
        create: [{ status: "REGISTERED", note: "Colis enregistré" }],
      },
    },
  });

  // Si lié à une réservation, marquer celle-ci comme RECEIVED
  if (data.reservationId) {
    await prisma.reservation.update({
      where: { id: data.reservationId },
      data: { status: "RECEIVED" },
    });
  }

  // Notification WhatsApp au DESTINATAIRE — confirmation d'enregistrement
  const notifyTo = data.recipientPhone || (client ? client.whatsapp || client.phone : data.clientPhone) || null;
  const notifyName = data.recipientName || (client ? client.name : data.clientName) || "Destinataire";
  if (notifyTo) {
    await sendWhatsApp({
      to: notifyTo,
      body: shipmentCreatedTemplate({
        clientName: notifyName,
        trackingNumber,
        totalAmount: pricing.totalAmount,
        depositAmount: pricing.depositAmount,
        remainingAmount: pricing.remainingAmount,
        mode: TRANSPORT_MODE_LABELS[data.mode as TransportMode],
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        destinationCity: data.destinationCity,
      }),
      template: "shipment_created",
      userId: client?.id,
    });
  }

  if (client?.id) {
    const tpl = inAppShipmentCreated({
      trackingNumber,
      mode: TRANSPORT_MODE_LABELS[data.mode as TransportMode],
    });
    await notifyInApp({
      userId: client.id,
      template: "shipment_created",
      ...tpl,
    });
  }

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard");
  return { success: true, data: { trackingNumber, id: shipment.id } };
}

export async function updateShipmentStatus(input: {
  shipmentId: string;
  status: ShipmentStatus;
  note?: string;
  location?: string;
}): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");

  const shipment = await prisma.shipment.findUnique({
    where: { id: input.shipmentId },
    include: { client: true },
  });
  if (!shipment) return { success: false, error: "Expédition introuvable." };

  await prisma.shipment.update({
    where: { id: input.shipmentId },
    data: {
      status: input.status,
      history: {
        create: {
          status: input.status,
          note: input.note,
          location: input.location,
          createdBy: session.user.id,
        },
      },
    },
  });

  // Notification WhatsApp si statut = AVAILABLE_FOR_DELIVERY → envoyée au DESTINATAIRE
  if (input.status === "AVAILABLE_FOR_DELIVERY") {
    // Priorité : recipientPhone du colis → sinon téléphone du client
    const recipientPhone =
      shipment.recipientPhone ||
      (shipment.client ? shipment.client.whatsapp || shipment.client.phone : shipment.clientPhone);
    const recipientName =
      shipment.recipientName ||
      shipment.client?.name ||
      shipment.clientName ||
      "Destinataire";
    if (recipientPhone) {
      const depositPaid = shipment.amountPaid >= shipment.depositAmount;
      const remaining = Math.max(0, shipment.totalAmount - shipment.amountPaid);
      await sendWhatsApp({
        to: recipientPhone,
        body: shipmentAvailableTemplate({
          recipientName,
          trackingNumber: shipment.trackingNumber,
          remainingAmount: remaining,
          totalAmount: shipment.totalAmount,
          depositPaid,
          pickupAddress: input.location,
          destinationCity: shipment.destinationCity ?? undefined,
        }),
        template: "available_for_delivery",
        userId: shipment.clientId ?? undefined,
      });
    }
  }

  // Notification in-app pour le client à chaque changement de statut
  if (shipment.clientId) {
    const tpl =
      input.status === "AVAILABLE_FOR_DELIVERY"
        ? inAppShipmentAvailable({ trackingNumber: shipment.trackingNumber })
        : inAppShipmentStatus({
            trackingNumber: shipment.trackingNumber,
            status: input.status,
            statusLabel: SHIPMENT_STATUS_LABELS[input.status] ?? input.status,
          });
    await notifyInApp({
      userId: shipment.clientId,
      template:
        input.status === "AVAILABLE_FOR_DELIVERY"
          ? "available_for_delivery"
          : `shipment_status_${input.status.toLowerCase()}`,
      ...tpl,
    });
  }

  revalidatePath(`/tracking/${shipment.trackingNumber}`);
  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  return { success: true };
}

export async function recordShipmentPayment(input: {
  shipmentId: string;
  amount: number;
}): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const shipment = await prisma.shipment.findUnique({ where: { id: input.shipmentId } });
  if (!shipment) return { success: false, error: "Expédition introuvable." };

  const newPaid = shipment.amountPaid + input.amount;
  let paymentStatus = shipment.paymentStatus;
  if (newPaid >= shipment.totalAmount) paymentStatus = "FULLY_PAID";
  else if (newPaid >= shipment.depositAmount) paymentStatus = "DEPOSIT_PAID";

  await prisma.shipment.update({
    where: { id: input.shipmentId },
    data: { amountPaid: newPaid, paymentStatus },
  });

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  return { success: true };
}
