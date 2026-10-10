import { prisma } from "./prisma";
import { notifyInApp } from "./notifications";

/**
 * Quand un colis lié à une commande catalogue est livré : si TOUS les colis de
 * la commande sont livrés, la commande passe en DELIVERED et le client est notifié.
 */
export async function syncCatalogOrderDelivered(shipmentId: string): Promise<void> {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { catalogOrderId: true },
    });
    if (!shipment?.catalogOrderId) return;
    const order = await prisma.catalogOrder.findUnique({
      where: { id: shipment.catalogOrderId },
      select: { id: true, status: true, reference: true, clientId: true, shipments: { select: { status: true } } },
    });
    if (!order || order.status === "DELIVERED" || order.status === "CANCELLED") return;
    if (order.shipments.length === 0 || order.shipments.some((s) => s.status !== "DELIVERED")) return;
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await notifyInApp({
      userId: order.clientId,
      template: "catalog_order_delivered",
      title: "Commande livrée",
      body: `Votre commande ${order.reference} a été livrée.`,
      link: "/dashboard/orders",
    });
  } catch (e) {
    console.error("[syncCatalogOrderDelivered]", e);
  }
}
