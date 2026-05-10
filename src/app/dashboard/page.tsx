import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHomeClient } from "./dashboard-home-client";

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/staff");

  const userId = session.user.id;
  const [shipments, reservations, totalDue] = await Promise.all([
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
