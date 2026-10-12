import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATALOG_ORDER_ACTIVE_STATUSES, isDirectOrder, orderAmountsVisible } from "@/lib/catalog-labels";
import { DashboardHomeClient } from "./dashboard-home-client";

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/staff");

  const userId = session.user.id;
  const activeOrdersWhere = { clientId: userId, status: { in: [...CATALOG_ORDER_ACTIVE_STATUSES] } };
  const [shipments, reservations, totalDue, orders, ordersInProgress] = await Promise.all([
    prisma.shipment.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.shipment.aggregate({
      where: { clientId: userId, paymentStatus: { not: "FULLY_PAID" } },
      _sum: { totalAmount: true, amountPaid: true },
    }),
    // Commandes catalogue en cours (ni livrées ni annulées)
    prisma.catalogOrder.findMany({
      where: activeOrdersWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        reference: true,
        status: true,
        createdAt: true,
        quotedAt: true,
        acceptedAt: true,
        totalAmount: true,
        _count: { select: { items: true } },
        shipments: { select: { trackingNumber: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.catalogOrder.count({ where: activeOrdersWhere }),
  ]);

  const totalShipments = await prisma.shipment.count({ where: { clientId: userId } });
  const inTransit = await prisma.shipment.count({
    where: {
      clientId: userId,
      status: { in: ["IN_TRANSIT", "RECEIVED_CHINA", "ARRIVED_DESTINATION", "CUSTOMS_CLEARANCE"] },
    },
  });
  const available = await prisma.shipment.count({
    where: { clientId: userId, status: "AVAILABLE_FOR_DELIVERY" },
  });
  const due = (totalDue._sum.totalAmount ?? 0) - (totalDue._sum.amountPaid ?? 0);

  return (
    <DashboardHomeClient
      totalShipments={totalShipments}
      inTransit={inTransit}
      available={available}
      due={due}
      shipments={shipments.map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber,
        status: s.status,
        mode: s.mode,
        totalAmount: s.totalAmount,
        createdAt: s.createdAt,
      }))}
      ordersInProgress={ordersInProgress}
      orders={orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        createdAt: o.createdAt,
        itemCount: o._count.items,
        // Montant montré une fois le devis envoyé, ou tout de suite pour une commande aux prix affichés
        quotedAmount: orderAmountsVisible(o) ? o.totalAmount : null,
        direct: isDirectOrder(o),
        trackingNumbers: o.shipments.map((s) => s.trackingNumber),
      }))}
      reservations={reservations.map((r) => ({
        id: r.id,
        status: r.status,
        mode: r.mode,
        supplierTrackingNumber: r.supplierTrackingNumber,
        createdAt: r.createdAt,
      }))}
    />
  );
}
