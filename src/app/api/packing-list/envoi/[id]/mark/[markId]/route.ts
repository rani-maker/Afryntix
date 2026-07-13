import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; markId: string }> },
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id, markId } = await params;
  const containerId = req.nextUrl.searchParams.get("containerId");

  const envoi = await prisma.envoi.findUnique({
    where: { id },
    include: {
      shipments: {
        where: {
          shippingMarkId: markId,
          ...(containerId ? { containerId } : {}),
        },
        orderBy: { trackingNumber: "asc" },
      },
    },
  });
  if (!envoi) return NextResponse.json({ error: "Envoi introuvable" }, { status: 404 });

  const mark = await prisma.shippingMark.findUnique({ where: { id: markId } });
  if (!mark) return NextResponse.json({ error: "Shipping mark introuvable" }, { status: 404 });
  if (envoi.shipments.length === 0) {
    return NextResponse.json(
      { error: "Aucun colis de ce shipping mark dans cet envoi" },
      { status: 404 },
    );
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
  const packingMark: PackingListMark = {
    name: mark.name,
    phone: mark.phone,
    recipientName: first.recipientName ?? null,
    destination: [first.destinationCity, first.destinationCountry].filter(Boolean).join(", "),
  };

  const csv = buildPackingListCsv(
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
    packingMark,
    rows,
  );

  const safeMark = mark.name.replace(/\W+/g, "_");
  const filename = `packing-list-${envoi.reference}-${safeMark}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
