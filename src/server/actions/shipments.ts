"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, auth } from "@/auth";
import { generateTrackingNumber } from "@/lib/utils";
import { computePrice, trackingPrefix, TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import {
  sendWhatsApp,
  shipmentCreatedTemplate,
  shipmentAvailableTemplate,
  shipmentsAvailableTemplate,
} from "@/lib/whatsapp";
import {
  notifyInApp,
  inAppShipmentCreated,
  inAppShipmentAvailable,
  inAppShipmentStatus,
} from "@/lib/notifications";
import { upsertShippingMark } from "./shippingMarks";
import { getOrCreateFactureForShipments } from "./factures";
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

  // Générer le numéro de suivi
  let trackingNumber = generateTrackingNumber(trackingPrefix(data.mode as TransportMode));
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!exists) break;
    trackingNumber = generateTrackingNumber(trackingPrefix(data.mode as TransportMode));
  }

  // Upsert du ShippingMark — nom/téléphone du destinataire (physique sur les cartons)
  // Priorité : recipientName+recipientPhone si renseignés, sinon clientName+clientPhone
  const markName = data.recipientName || (client ? client.name : data.clientName) || null;
  const markPhone = data.recipientPhone || (client ? client.whatsapp || client.phone : data.clientPhone) || null;

  let shippingMarkId: string | null = null;
  if (markName && markPhone) {
    const mark = await upsertShippingMark({ name: markName, phone: markPhone });
    if (mark) {
      shippingMarkId = mark.id;
      // Lier au compte client si pas encore fait
      if (client && !mark.userId) {
        await prisma.shippingMark.update({
          where: { id: mark.id },
          data: { userId: client.id },
        });
      }
    }
  }

  const chargeableWeight = pricing.unit === "kg" ? pricing.chargeableQuantity : undefined;

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      clientId: data.clientId || null,
      clientName: data.clientId ? null : data.clientName,
      clientPhone: data.clientId ? null : data.clientPhone,
      shippingMarkId,
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

  if (data.reservationId) {
    await prisma.reservation.update({
      where: { id: data.reservationId },
      data: { status: "RECEIVED" },
    });
  }

  // Notification WhatsApp au DESTINATAIRE
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
        modeKey: data.mode,
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
    await notifyInApp({ userId: client.id, template: "shipment_created", ...tpl });
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
    include: { client: true, shippingMark: true },
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

  if (input.status === "AVAILABLE_FOR_DELIVERY") {
    await handleAvailableForDelivery(shipment, input.location);
  }

  // Notification in-app pour le client
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

async function handleAvailableForDelivery(
  shipment: {
    id: string;
    trackingNumber: string;
    shippingMarkId: string | null;
    clientId: string | null;
    clientName: string | null;
    clientPhone: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    envoiId: string | null;
    totalAmount: number;
    depositAmount: number;
    amountPaid: number;
    remainingAmount: number;
    mode: TransportMode;
    description: string | null;
    destinationCity: string | null;
    shippingMark: { id: string; name: string; phone: string; whatsapp: string | null } | null;
    client: { name: string; whatsapp: string | null; phone: string | null } | null;
  },
  location?: string,
) {
  const recipientPhone =
    shipment.recipientPhone ||
    (shipment.client ? shipment.client.whatsapp || shipment.client.phone : shipment.clientPhone);
  const recipientName =
    shipment.recipientName || shipment.shippingMark?.name || shipment.client?.name || shipment.clientName || "Destinataire";

  if (!recipientPhone) return;

  // Chercher les autres colis disponibles du même ShippingMark + même Envoi
  const groupedShipments = shipment.shippingMarkId && shipment.envoiId
    ? await prisma.shipment.findMany({
        where: {
          shippingMarkId: shipment.shippingMarkId,
          envoiId: shipment.envoiId,
          status: "AVAILABLE_FOR_DELIVERY",
          id: { not: shipment.id },
        },
        select: { id: true, trackingNumber: true, totalAmount: true, depositAmount: true, amountPaid: true, remainingAmount: true, description: true, mode: true },
      })
    : [];

  // Tous les colis de ce ShippingMark encore en transit (pour informer le client)
  const enTransitShipments = shipment.shippingMarkId
    ? await prisma.shipment.findMany({
        where: {
          shippingMarkId: shipment.shippingMarkId,
          status: { in: ["REGISTERED", "RECEIVED_CHINA", "IN_TRANSIT", "CUSTOMS_CLEARANCE"] },
        },
        select: { trackingNumber: true, envoi: { select: { reference: true } } },
      })
    : [];

  const allAvailableForThisMark = [shipment, ...groupedShipments];
  const allIds = allAvailableForThisMark.map((s) => s.id);

  // Créer/mettre à jour la Facture groupée
  const facture = await getOrCreateFactureForShipments({
    shipmentIds: allIds,
    shippingMarkId: shipment.shippingMarkId ?? undefined,
    clientId: shipment.clientId ?? undefined,
    envoiId: shipment.envoiId ?? undefined,
  });

  const totalPaid = allAvailableForThisMark.reduce((sum, s) => sum + s.amountPaid, 0);
  const totalAmount = allAvailableForThisMark.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalDeposit = allAvailableForThisMark.reduce((sum, s) => sum + s.depositAmount, 0);
  const totalRemaining = Math.max(0, totalAmount - totalPaid);
  const depositPaid = totalPaid >= totalDeposit;

  if (allAvailableForThisMark.length > 1) {
    // Template multi-colis
    await sendWhatsApp({
      to: recipientPhone,
      body: shipmentsAvailableTemplate({
        recipientName,
        colis: allAvailableForThisMark.map((s) => ({
          trackingNumber: s.trackingNumber,
          description: s.description,
          mode: TRANSPORT_MODE_LABELS[s.mode],
          modeKey: s.mode,
        })),
        factureReference: facture.reference,
        totalAmount,
        amountPaid: totalPaid,
        remainingAmount: totalRemaining,
        depositPaid,
        enTransit: enTransitShipments.map((s) => ({
          trackingNumber: s.trackingNumber,
          envoiReference: s.envoi?.reference ?? null,
        })),
        destinationCity: shipment.destinationCity ?? undefined,
      }),
      template: "available_for_delivery",
      userId: shipment.clientId ?? undefined,
    });
  } else {
    // Template colis unique (avec référence facture en note)
    const depositPaidSingle = shipment.amountPaid >= shipment.depositAmount;
    const remainingSingle = Math.max(0, shipment.totalAmount - shipment.amountPaid);
    await sendWhatsApp({
      to: recipientPhone,
      body: shipmentAvailableTemplate({
        recipientName,
        trackingNumber: shipment.trackingNumber,
        remainingAmount: remainingSingle,
        totalAmount: shipment.totalAmount,
        depositPaid: depositPaidSingle,
        pickupAddress: location,
        destinationCity: shipment.destinationCity ?? undefined,
        factureReference: facture.reference,
        enTransit: enTransitShipments.map((s) => ({
          trackingNumber: s.trackingNumber,
          envoiReference: s.envoi?.reference ?? null,
        })),
      }),
      template: "available_for_delivery",
      userId: shipment.clientId ?? undefined,
    });
  }
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

  // Mettre à jour la facture liée si elle existe
  if (shipment.factureId) {
    const facture = await prisma.facture.findUnique({
      where: { id: shipment.factureId },
      select: { amountPaid: true, totalAmount: true, depositAmount: true },
    });
    if (facture) {
      const newFacturePaid = facture.amountPaid + input.amount;
      const newFactureRemaining = Math.max(0, facture.totalAmount - newFacturePaid);
      let factureStatus: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED" = "UNPAID";
      if (newFacturePaid >= facture.totalAmount) factureStatus = "FULLY_PAID";
      else if (newFacturePaid >= facture.depositAmount) factureStatus = "DEPOSIT_PAID";
      await prisma.facture.update({
        where: { id: shipment.factureId },
        data: { amountPaid: newFacturePaid, remainingAmount: newFactureRemaining, status: factureStatus },
      });
    }
  }

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  return { success: true };
}

export async function deleteShipment(id: string): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, envoiId: true } });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (shipment.envoiId) return { success: false, error: "Ce colis est rattaché à un envoi. Détachez-le d'abord." };

  await prisma.shipment.delete({ where: { id } });

  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard");
  return { success: true };
}
