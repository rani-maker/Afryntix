import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function StaffClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.UserWhereInput = {
    role: "CLIENT",
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { whatsapp: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const clients = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { shipmentsAsClient: true, reservations: true, billPaymentsClient: true } },
    },
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Clients ({clients.length})</CardTitle>
        <form className="flex gap-2 max-w-md" action="/staff/clients">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Rechercher par nom d'utilisateur, email, téléphone…"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href="/staff/clients">Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead className="text-center">Expéditions</TableHead>
              <TableHead className="text-center">Réservations</TableHead>
              <TableHead className="text-center">Paiements</TableHead>
              <TableHead>Inscrit</TableHead>
              <TableHead className="text-right">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                  {search ? `Aucun client ne correspond à « ${search} ».` : "Aucun client inscrit pour le moment."}
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{c.email}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.whatsapp ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-center">{c._count.shipmentsAsClient}</TableCell>
                  <TableCell className="text-center">{c._count.reservations}</TableCell>
                  <TableCell className="text-center">{c._count.billPaymentsClient}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {c.active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Désactivé</Badge>
                    )}
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
