import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  QUALITY_CONTROL: "Contrôle qualité",
  PURCHASING: "Achat / Sourcing",
  VEHICLE_SALE: "Achat véhicule",
  BTP_SALE: "Achat engin BTP",
  TRADING: "Paiement de facture",
  INTRODUCTION: "Négoce",
};

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.ServiceRequestWhereInput = search
    ? {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { clientName: { contains: search, mode: "insensitive" } },
          { clientEmail: { contains: search, mode: "insensitive" } },
          { clientPhone: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
          { budget: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const requests = await prisma.serviceRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Demandes de service ({requests.length})</CardTitle>
        <form className="flex gap-2 max-w-md" action="/admin/services">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Référence, demandeur, email, téléphone, message…"
          />
          <Button type="submit" variant="outline">Rechercher</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href="/admin/services">Effacer</Link>
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Reçu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  {search ? `Aucune demande ne correspond à « ${search} ».` : "Aucune demande pour le moment."}
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell>
                    <Badge variant="info">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.clientPhone}
                      {r.clientEmail ? ` • ${r.clientEmail}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs line-clamp-3">{r.message}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.budget ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "COMPLETED" ? "success" : "warning"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
