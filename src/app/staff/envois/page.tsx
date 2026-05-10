import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { TRANSPORT_MODE_LABELS, ENVOI_STATUS_LABELS, CARRIER_LABELS } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";

export default async function StaffEnvoisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.EnvoiWhereInput = search
    ? {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { bookingNumber: { contains: search, mode: "insensitive" } },
          { mawb: { contains: search, mode: "insensitive" } },
          { vesselName: { contains: search, mode: "insensitive" } },
          { destination: { contains: search, mode: "insensitive" } },
          { containers: { some: { refInternal: { contains: search, mode: "insensitive" } } } },
          { containers: { some: { carrierNumber: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : {};

  const envois = await prisma.envoi.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: { select: { shipments: true, containers: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Envois ({envois.length})</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Voyages groupés (aérien express, maritime, …) regroupant plusieurs colis.
              </p>
            </div>
            <Button asChild>
              <Link href="/staff/envois/new">
                <Plus className="h-4 w-4" /> Nouvel envoi
              </Link>
            </Button>
          </div>
          <form className="flex gap-2 max-w-xl" action="/staff/envois">
            <Input
              name="q"
              defaultValue={search}
              placeholder="Réf envoi, n° conteneur, MAWB, navire, booking…"
              className="font-mono"
            />
            <Button type="submit" variant="outline">Rechercher</Button>
            {search && (
              <Button asChild variant="ghost">
                <Link href="/staff/envois">Effacer</Link>
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Colis</TableHead>
                <TableHead className="text-right">Conteneurs</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envois.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Aucun envoi.
                  </TableCell>
                </TableRow>
              ) : (
                envois.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                    <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[e.mode]}</TableCell>
                    <TableCell className="text-sm">
                      {e.carrier ? CARRIER_LABELS[e.carrier] : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{e.destination}</TableCell>
                    <TableCell>
                      <Badge variant="info">{ENVOI_STATUS_LABELS[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{e._count.shipments}</TableCell>
                    <TableCell className="text-right text-sm">{e._count.containers}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.departureDate ? formatDate(e.departureDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/staff/envois/${e.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Ouvrir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
