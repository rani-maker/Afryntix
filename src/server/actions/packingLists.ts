"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  buildPackingListCsv,
  type PackingListRow,
  type PackingListMark,
} from "@/lib/manifest";
import {
  TRANSPORT_MODE_LABELS,
  CARRIER_LABELS,
  CARGO_CATEGORY_LABELS,
} from "@/lib/pricing";
import { sendEmail, emailPackingList } from "@/lib/email";

type Result = { success: true; notificationId?: string; to: string } | { success: false; error: string };

const SendSchema = z.object({
  envoiId: z.string().min(1),
  markId: z.string().min(1),
  containerId: z.string().optional(),
  overrideEmail: z.string().email().optional(),
});

/**
 * Envoie par email le packing list d'un shipping mark pour un envoi donné.
 * Le CSV est joint. La vue est "client" (sans montants ni statut de paiement).
 * Réservé STAFF + ADMIN. Ne s'active que si l'envoi est parti (DEPARTED+).
 */
export async function sendPackingListToMark(input: unknown): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const parsed = SendSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { envoiId, markId, containerId, overrideEmail } = parsed.data;

  const envoi = await prisma.envoi.findUnique({
    where: { id: envoiId },
    include: {
      shipments: {
        where: {
          shippingMarkId: markId,
          ...(containerId ? { containerId } : {}),
        },
        include: {
          client: { select: { id: true, email: true, name: true } },
        },
        orderBy: { trackingNumber: "asc" },
      },
    },
  });
  if (!envoi) return { success: false, error: "Envoi introuvable." };

  const allowedStatuses = ["DEPARTED", "IN_TRANSIT", "ARRIVED", "CLEARED", "DELIVERED"] as const;
  if (!allowedStatuses.includes(envoi.status as (typeof allowedStatuses)[number])) {
    return {
      success: false,
      error: "Le packing list ne peut être envoyé qu'à partir du départ de l'envoi.",
    };
  }

  if (envoi.shipments.length === 0) {
    return { success: false, error: "Aucun colis de ce shipping mark dans cet envoi." };
  }

  const mark = await prisma.shippingMark.findUnique({
    where: { id: markId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!mark) return { success: false, error: "Shipping mark introuvable." };

  // Résolution du destinataire :
  // 1. overrideEmail (saisi par le staff)
  // 2. email du compte User rattaché au shipping mark
  // 3. email du client sur l'un des colis (le premier trouvé)
  const clientEmailFallback = envoi.shipments
    .map((s) => s.client?.email)
    .find((e): e is string => !!e);
  const to = overrideEmail ?? mark.user?.email ?? clientEmailFallback ?? null;
  if (!to) {
    return {
      success: false,
      error:
        "Aucun email destinataire trouvé. Rattachez le shipping mark à un compte client ou saisissez un email manuellement.",
    };
  }

  let containerLabel: string | null = null;
  if (containerId) {
    const c = await prisma.container.findUnique({ where: { id: containerId } });
    if (c) containerLabel = `${c.refInternal}${c.carrierNumber ? ` / ${c.carrierNumber}` : ""}`;
  }

  const rows: PackingListRow[] = envoi.shipments.map((s) => ({
    trackingNumber: s.trackingNumber,
    pieces: s.pieces,
    weightKg: s.weightKg,
    lengthCm: s.lengthCm,
    widthCm: s.widthCm,
    heightCm: s.heightCm,
    volumeCBM: s.volumeCBM,
    description: s.description,
    category: CARGO_CATEGORY_LABELS[s.category],
    hsCode: s.hsCode,
    incoterm: s.incoterm,
    countryOfOrigin: s.countryOfOrigin,
    declaredCustomsValue: s.declaredCustomsValue,
  }));

  const first = envoi.shipments[0];
  const destinationLabel = [first.destinationCity, first.destinationCountry]
    .filter(Boolean)
    .join(", ");
  const packingMark: PackingListMark = {
    name: mark.name,
    phone: mark.phone,
    recipientName: first.recipientName ?? null,
    destination: destinationLabel,
  };

  const modeLabel = TRANSPORT_MODE_LABELS[envoi.mode];
  const csv = buildPackingListCsv(
    {
      envoiReference: envoi.reference,
      envoiMode: modeLabel,
      origin: envoi.origin,
      destination: envoi.destination,
      departureDate: envoi.departureDate,
      arrivalDate: envoi.arrivalDate,
      carrier: envoi.carrier ? CARRIER_LABELS[envoi.carrier] : null,
      bookingNumber: envoi.bookingNumber,
      vesselName: envoi.vesselName,
      voyageNumber: envoi.voyageNumber,
      mawb: envoi.mawb,
      flightNumber: envoi.flightNumber,
      containerLabel,
    },
    packingMark,
    rows,
  );

  const safeMark = mark.name.replace(/\W+/g, "_");
  const filename = `packing-list-${envoi.reference}-${safeMark}.csv`;
  const csvBase64 = Buffer.from(csv, "utf-8").toString("base64");

  const totals = envoi.shipments.reduce(
    (acc, s) => {
      acc.pieces += s.pieces;
      acc.weight += s.weightKg ?? 0;
      acc.cbm += s.volumeCBM ?? 0;
      return acc;
    },
    { pieces: 0, weight: 0, cbm: 0 },
  );

  const appUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const printUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/print/packing-list/envoi/${envoi.id}/mark/${mark.id}${containerId ? `?containerId=${containerId}` : ""}`
    : null;

  const vesselOrFlight = envoi.vesselName
    ? `${envoi.vesselName}${envoi.voyageNumber ? ` / ${envoi.voyageNumber}` : ""}`
    : envoi.mawb
      ? `${envoi.mawb}${envoi.flightNumber ? ` / ${envoi.flightNumber}` : ""}`
      : null;

  const recipientName = mark.user?.name ?? first.recipientName ?? mark.name;
  const { subject, html } = emailPackingList({
    recipientName,
    shippingMarkName: mark.name,
    envoiReference: envoi.reference,
    envoiMode: modeLabel,
    origin: envoi.origin,
    destination: envoi.destination,
    departureDate: envoi.departureDate,
    arrivalDate: envoi.arrivalDate,
    carrier: envoi.carrier ? CARRIER_LABELS[envoi.carrier] : null,
    vesselOrFlight,
    containerLabel,
    totalPieces: totals.pieces,
    totalWeightKg: totals.weight,
    totalCBM: totals.cbm,
    packagesCount: envoi.shipments.length,
    printUrl,
  });

  const notification = await sendEmail({
    to,
    subject,
    html,
    template: "packing_list",
    userId: mark.user?.id,
    attachments: [
      { filename, content: csvBase64, contentType: "text/csv" },
    ],
  });

  revalidatePath(`/staff/envois/${envoi.id}`);
  revalidatePath(`/admin/envois/${envoi.id}`);

  return { success: true, notificationId: notification.id, to };
}
