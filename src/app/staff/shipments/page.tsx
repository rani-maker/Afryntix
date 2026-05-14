import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { ShipmentsBulkTable } from "@/components/dashboard/shipments-bulk-table";

export default async function StaffShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view } = await searchParams;
  const search = q?.trim() ?? "";
  const groupedView = view === "grouped";

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
          { shippingMark: { name: { contains: search, mode: "insensitive" } } },
          { shippingMark: { phone: { contains: search } } },
          { facture: { reference: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [shipments, envois] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, email: true } },
        shippingMark: { select: { id: true, name: true, phone: true } },
        facture: { select: { reference: true, status: true, remainingAmount: true } },
      },
      take: 100,
    }),
    prisma.envoi.findMany({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      select: { id: true, reference: true, mode: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const rows = shipments.map((s) => ({
    ...s,
    client: s.client
      ? { name: s.client.name, email: s.client.email ?? undefined }
      : s.clientName
      ? { name: s.clientName, email: s.clientPhone ?? undefined }
      : null,
  }));

  // Vue groupée par Shipping Mark
  const grouped = groupedView
    ? groupByShippingMark(shipments)
    : null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Expéditions ({shipments.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Link
              href={`/staff/shipments?view=${groupedView ? "list" : "grouped"}${search ? `&q=${search}` : ""}`}
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              {groupedView ? "Vue liste" : "Vue par shipping mark"}
            </Link>
            <Button asChild>
              <Link href="/staff/shipments/new">
                <Plus className="h-4 w-4" /> Nouvelle expédition
              </Link>
            </Button>
          </div>
        </div>
        <form className="flex gap-2 max-w-xl" action="/staff/shipments">
          <input type="hidden" name="view" value={view ?? "list"} />
          <Input
            name="q"
            defaultValue={search}
            placeholder="N° suivi, destinataire, ville, client, shipping mark, facture…"
            className="font-mono"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href={`/staff/shipments${groupedView ? "?view=grouped" : ""}`}>Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        {grouped ? (
          <GroupedView groups={grouped} />
        ) : (
          <ShipmentsBulkTable
            rows={rows.map((s) => ({
              id: s.id,
              trackingNumber: s.trackingNumber,
              mode: s.mode,
              status: s.status,
              paymentStatus: s.paymentStatus,
              totalAmount: s.totalAmount,
              amountPaid: s.amountPaid,
              createdAt: s.createdAt,
              client: s.client ?? null,
            }))}
            envois={envois}
            manageHref={(id) => `/staff/shipments/${id}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

type ShipmentWithMark = {
  id: string;
  trackingNumber: string;
  mode: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  amountPaid: number;
  createdAt: Date;
  clientName: string | null;
  clientPhone: string | null;
  recipientName: string | null;
  shippingMark: { id: string; name: string; phone: string } | null;
  facture: { reference: string; status: string; remainingAmount: number } | null;
  client: { name: string; email: string } | null;
};

function groupByShippingMark(shipments: ShipmentWithMark[]) {
  const map = new Map<string, { label: string; phone: string; shipments: ShipmentWithMark[] }>();

  for (const s of shipments) {
    const key = s.shippingMark
      ? `mark:${s.shippingMark.id}`
      : `free:${s.clientName ?? ""}:${s.clientPhone ?? ""}`;

    const label = s.shippingMark?.name ?? s.clientName ?? s.client?.name ?? "Inconnu";
    const phone = s.shippingMark?.phone ?? s.clientPhone ?? "";

    if (!map.has(key)) map.set(key, { label, phone, shipments: [] });
    map.get(key)!.shipments.push(s);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function GroupedView({ groups }: { groups: ReturnType<typeof groupByShippingMark> }) {
  if (groups.length === 0) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Aucune expédition.</div>;
  }
  return (
    <div className="divide-y">
      {groups.map((group) => {
        const factureRefs = [...new Set(group.shipments.map((s) => s.facture?.reference).filter(Boolean))];
        const totalDue = group.shipments
          .filter((s) => s.facture && s.facture.status !== "FULLY_PAID")
          .reduce((sum, s) => sum + (s.facture?.remainingAmount ?? 0), 0);

        return (
          <div key={group.label + group.phone} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="font-semibold">{group.label}</span>
                {group.phone && (
                  <span className="ml-2 text-sm text-muted-foreground">{group.phone}</span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">
                  {group.shipments.length} colis
                </span>
              </div>
              <div className="text-right text-sm">
                {factureRefs.length > 0 && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {factureRefs.join(" · ")}
                  </div>
                )}
                {totalDue > 0 && (
                  <div className="text-destructive font-medium text-xs">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(totalDue)} restants
                  </div>
                )}
              </div>
            </div>
            <div className="pl-2 space-y-1">
              {group.shipments.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm flex-wrap">
                  <Link href={`/tracking/${s.trackingNumber}`} className="font-mono text-primary hover:underline text-xs">
                    {s.trackingNumber}
                  </Link>
                  <span className="text-xs text-muted-foreground">{s.recipientName ?? "—"}</span>
                  {s.facture && (
                    <span className="font-mono text-xs text-muted-foreground">{s.facture.reference}</span>
                  )}
                  <Link href={`/staff/shipments/${s.id}`} className="text-xs text-muted-foreground hover:text-primary ml-auto">
                    Gérer
                  </Link>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
