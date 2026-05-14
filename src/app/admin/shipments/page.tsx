import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShipmentsBulkTable } from "@/components/dashboard/shipments-bulk-table";

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.ShipmentWhereInput = search
    ? {
        OR: [
          { trackingNumber: { contains: search, mode: "insensitive" } },
          { clientName: { contains: search, mode: "insensitive" } },
          { clientPhone: { contains: search, mode: "insensitive" } },
          { recipientName: { contains: search, mode: "insensitive" } },
          { recipientPhone: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
          { client: { email: { contains: search, mode: "insensitive" } } },
          { client: { phone: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [shipments, envois] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, email: true } } },
      take: 100,
    }),
    prisma.envoi.findMany({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      select: { id: true, reference: true, mode: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Toutes les expéditions ({shipments.length})</CardTitle>
        <form className="flex gap-2 max-w-md" action="/admin/shipments">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Tracking, client, téléphone, destinataire…"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href="/admin/shipments">Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        <ShipmentsBulkTable
          rows={shipments.map((s) => ({
            id: s.id,
            trackingNumber: s.trackingNumber,
            mode: s.mode,
            status: s.status,
            paymentStatus: s.paymentStatus,
            totalAmount: s.totalAmount,
            amountPaid: s.amountPaid,
            createdAt: s.createdAt,
            client: s.client ? { name: s.client.name, email: s.client.email ?? undefined } : null,
          }))}
          envois={envois}
          manageHref={(id) => `/staff/shipments/${id}`}
        />
      </CardContent>
    </Card>
  );
}
