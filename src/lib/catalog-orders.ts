import { prisma } from "./prisma";
import { notifyInApp } from "./notifications";
import { sendEmail, emailCatalogOrderTeam, TEAM_EMAIL } from "./email";
import { generateReference, getAppUrl } from "./utils";

export async function uniqueOrderReference(): Promise<string> {
  let reference = generateReference("CMD");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.catalogOrder.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) break;
    reference = generateReference("CMD");
  }
  return reference;
}

/** Prévient toute l'équipe (staff + admin) dans la cloche de notifications. */
export async function notifyOrderTeam(args: { template: string; title: string; body: string; orderId: string }) {
  const team = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, active: true },
    select: { id: true },
  });
  await Promise.all(
    team.map((u) =>
      notifyInApp({
        userId: u.id,
        template: args.template,
        title: args.title,
        body: args.body,
        link: `/staff/orders/${args.orderId}`,
      }),
    ),
  );
}

/** Email à la boîte de l'équipe (TEAM_EMAIL). Ne bloque jamais l'action en cas d'échec. */
export async function emailOrderTeam(
  orderId: string,
  template: string,
  args: Omit<Parameters<typeof emailCatalogOrderTeam>[0], "link">,
) {
  try {
    const mail = emailCatalogOrderTeam({ ...args, link: `${getAppUrl()}/staff/orders/${orderId}` });
    await sendEmail({ to: TEAM_EMAIL, subject: mail.subject, html: mail.html, template });
  } catch (e) {
    console.error("[catalogues] email équipe non envoyé:", e);
  }
}

type OrderParty = {
  contactPhone?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  client?: { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null } | null;
};

/**
 * Demandeur d'une commande : le client s'il a un compte, sinon les coordonnées
 * laissées dans le panier public (`guest: true`).
 */
export function orderParty(order: OrderParty): { name: string; email: string | null; phone: string | null; guest: boolean } {
  return {
    name: order.client?.name ?? order.guestName ?? "Client",
    email: order.client?.email ?? order.guestEmail ?? null,
    phone: order.contactPhone ?? order.client?.whatsapp ?? order.client?.phone ?? null,
    guest: !order.client,
  };
}

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
    if (!order.clientId) return; // demande sans compte : pas de cloche à alimenter
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
