import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildManifestCsv, type ManifestAudience, type ManifestRow } from "@/lib/manifest";
import {
  TRANSPORT_MODE_LABELS,
  CARRIER_LABELS,
  CARGO_CATEGORY_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/pricing";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const containerId = req.nextUrl.searchParams.get("containerId");
  const audience: ManifestAudience =
    req.nextUrl.searchParams.get("audience") === "forwarder" ? "forwarder" : "internal";

  const envoi = await prisma.envoi.findUnique({
    where: { id },
    include: {
      shipments: {
        where: containerId ? { containerId } : undefined,
        include: {
          client: { select: { name: true } },
          shippingMark: { select: { name: true, phone: true } },
        },
        orderBy: [{ shippingMarkId: "asc" }, { trackingNumber: "asc" }],
      },
    },
  });

  if (!envoi) {
    return NextResponse.json({ error: "Envoi introuvable" }, { status: 404 });
  }

  let containerLabel: string | null = null;
  if (containerId) {
    const c = await prisma.container.findUnique({ where: { id: containerId } });
    if (c) containerLabel = `${c.refInternal}${c.carrierNumber ? ` / ${c.carrierNumber}` : ""}`;
  }

  const rows: ManifestRow[] = envoi.shipments.map((s) => ({
    trackingNumber: s.trackingNumber,
    shippingMark: s.shippingMark
      ? audience === "forwarder"
        ? s.shippingMark.name
        : `${s.shippingMark.name} (${s.shippingMark.phone})`
      : null,
    client: s.client?.name ?? s.clientName ?? "—",
    pieces: s.pieces,
    weightKg: s.weightKg,
    volumetricWeight: s.volumetricWeight,
    chargeableWeight: s.chargeableWeight,
    volumeCBM: s.volumeCBM,
    description: s.description,
    destination: [s.destinationCity, s.destinationCountry].filter(Boolean).join(", "),
    category: CARGO_CATEGORY_LABELS[s.category],
    totalAmount: s.totalAmount,
    status: SHIPMENT_STATUS_LABELS[s.status] ?? s.status,
    hsCode: s.hsCode,
    incoterm: s.incoterm,
    countryOfOrigin: s.countryOfOrigin,
    declaredCustomsValue: s.declaredCustomsValue,
  }));

  const csv = buildManifestCsv(
    {
      envoiReference: envoi.reference,
      envoiMode: TRANSPORT_MODE_LABELS[envoi.mode],
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
    rows,
    audience,
  );

  const suffix = audience === "forwarder" ? "-transitaire" : "";
  const filename = containerId
    ? `manifeste${suffix}-${envoi.reference}-${containerLabel?.replace(/\W+/g, "_") ?? "container"}.csv`
    : `manifeste${suffix}-${envoi.reference}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
