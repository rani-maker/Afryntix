import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";

export default async function StaffShipmentsPage({
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
          { recipientName: { contains: search, mode: "insensitive" } },
          { recipientPhone: { contains: search, mode: "insensitive" } },
          { destinationCity: { contains: search, mode: "insensitive" } },
          { clientName: { contains: search, mode: "insensitive" } },
          { clientPhone: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
          { client: { email: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const shipments = await prisma.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true, email: true } } },
    take: 100,
  });

  const rows = shipments.map((s) => ({
    ...s,
    client: s.client
      ? { name: s.client.name, email: s.client.email ?? undefined }
      : s.clientName
      ? { name: s.clientName, email: s.clientPhone ?? undefined }
      : null,
  }));

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Expéditions ({shipments.length})</CardTitle>
          <Button asChild>
            <Link href="/staff/shipments/new">
              <Plus className="h-4 w-4" /> Nouvelle expédition
            </Link>
          </Button>
        </div>
        <form className="flex gap-2 max-w-xl" action="/staff/shipments">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Recherche par n° de suivi, destinataire, ville, client…"
            className="font-mono"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href="/staff/shipments">Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        <ShipmentsTable
          rows={rows}
          showClient
          manageHref={(id) => `/staff/shipments/${id}`}
        />
      </CardContent>
    </Card>
  );
}
