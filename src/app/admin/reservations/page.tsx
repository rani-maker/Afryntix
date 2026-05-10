import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.ReservationWhereInput = search
    ? {
        OR: [
          { supplierTrackingNumber: { contains: search, mode: "insensitive" } },
          { recipientName: { contains: search, mode: "insensitive" } },
          { recipientPhone: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
          { client: { email: { contains: search, mode: "insensitive" } } },
          { client: { phone: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const rows = await prisma.reservation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true, email: true, phone: true } } },
    take: 100,
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Toutes les réservations ({rows.length})</CardTitle>
        <form className="flex gap-2 max-w-md" action="/admin/reservations">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Client, email, téléphone, suivi fournisseur…"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href="/admin/reservations">Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Mode / Catégorie</TableHead>
              <TableHead>Suivi fournisseur</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {search ? `Aucune réservation ne correspond à « ${search} ».` : "Aucune réservation."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.client.name}</div>
                    <div className="text-xs text-muted-foreground">{r.client.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</div>
                    <div className="text-xs text-muted-foreground">{CARGO_CATEGORY_LABELS[r.category]}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.supplierTrackingNumber || "—"}</TableCell>
                  <TableCell>
                    {r.photoUrl ? (
                      <a
                        href={r.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        Voir photo
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
