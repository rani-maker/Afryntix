import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NewShipmentForm } from "./new-shipment-form";
import type { TransportMode, CargoCategory } from "@prisma/client";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });

  // Si la création part d'une réservation, on hydrate le formulaire avec
  // TOUTES les infos saisies par le client (mode, catégorie, description,
  // dimensions, et surtout DESTINATAIRE) : sinon le staff les retape à la
  // main et c'est une source majeure d'erreurs (mauvais destinataire, etc.).
  const reservationId = pick("reservationId");
  let reservationPrefill: {
    clientId?: string;
    mode?: TransportMode;
    category?: CargoCategory;
    description?: string;
    weightKg?: string;
    volumeCBM?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
  } = {};
  if (reservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        clientId: true,
        mode: true,
        category: true,
        description: true,
        estimatedWeightKg: true,
        estimatedVolumeCBM: true,
        recipientName: true,
        recipientPhone: true,
        recipientAddress: true,
      },
    });
    if (reservation) {
      reservationPrefill = {
        clientId: reservation.clientId ?? undefined,
        mode: reservation.mode,
        category: reservation.category,
        description: reservation.description ?? undefined,
        weightKg:
          reservation.estimatedWeightKg != null
            ? String(reservation.estimatedWeightKg)
            : undefined,
        volumeCBM:
          reservation.estimatedVolumeCBM != null
            ? String(reservation.estimatedVolumeCBM)
            : undefined,
        recipientName: reservation.recipientName ?? undefined,
        recipientPhone: reservation.recipientPhone ?? undefined,
        recipientAddress: reservation.recipientAddress ?? undefined,
      };
    }
  }

  // Création depuis une commande catalogue (devis accepté) : client, destinataire,
  // ville et description sont repris de la commande.
  const orderId = pick("orderId");
  let orderPrefill: {
    catalogOrderId?: string;
    orderReference?: string;
    clientId?: string;
    description?: string;
    recipientName?: string;
    recipientPhone?: string;
    destinationCity?: string;
  } = {};
  if (orderId) {
    const order = await prisma.catalogOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        reference: true,
        clientId: true,
        contactPhone: true,
        deliveryCity: true,
        client: { select: { name: true, phone: true, whatsapp: true } },
        items: { select: { quantity: true, reference: true, designation: true } },
      },
    });
    if (order) {
      const lines = order.items.map((i) => `${i.quantity} × ${i.designation} (${i.reference})`).join(" ; ");
      orderPrefill = {
        catalogOrderId: order.id,
        orderReference: order.reference,
        clientId: order.clientId,
        description: `Commande ${order.reference} — ${lines}`.slice(0, 480),
        recipientName: order.client.name,
        recipientPhone: order.contactPhone ?? order.client.whatsapp ?? order.client.phone ?? undefined,
        destinationCity: order.deliveryCity ?? undefined,
      };
    }
  }

  const initial = {
    reservationId,
    catalogOrderId: orderPrefill.catalogOrderId,
    orderReference: orderPrefill.orderReference,
    destinationCity: orderPrefill.destinationCity,
    clientId: orderPrefill.clientId ?? pick("clientId") ?? reservationPrefill.clientId,
    mode: (pick("mode") as TransportMode | undefined) ?? reservationPrefill.mode,
    category:
      (pick("category") as CargoCategory | undefined) ?? reservationPrefill.category,
    weightKg: pick("weightKg") ?? reservationPrefill.weightKg,
    volumeCBM: pick("volumeCBM") ?? reservationPrefill.volumeCBM,
    description: orderPrefill.description ?? reservationPrefill.description,
    recipientName: orderPrefill.recipientName ?? reservationPrefill.recipientName,
    recipientPhone: orderPrefill.recipientPhone ?? reservationPrefill.recipientPhone,
    recipientAddress: reservationPrefill.recipientAddress,
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Enregistrer une nouvelle expédition</CardTitle>
        <CardDescription>
          Le client recevra automatiquement son numéro de suivi et le détail de tarification par WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewShipmentForm clients={clients} initial={initial} />
      </CardContent>
    </Card>
  );
}
