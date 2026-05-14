import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CLAIM_TYPE_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUS_TONE } from "@/server/actions/claims";
import { formatDateTime, formatXOF } from "@/lib/utils";

export default async function StaffClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const claims = await prisma.claim.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      shipment: { select: { trackingNumber: true, client: { select: { name: true } }, clientName: true } },
      openedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const counts = await prisma.claim.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Réclamations</CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap text-xs">
            <Link
              href="/staff/claims"
              className={`px-3 py-1 rounded-full border ${!status ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Toutes ({total})
            </Link>
            {(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const).map((s) => {
              const n = counts.find((c) => c.status === s)?._count._all ?? 0;
              return (
                <Link
                  key={s}
                  href={`/staff/claims?status=${s}`}
                  className={`px-3 py-1 rounded-full border ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {CLAIM_STATUS_LABELS[s]} ({n})
                </Link>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Colis</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Demandé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Ouverte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Aucune réclamation.
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/staff/shipments/${c.shipmentId}`} className="hover:text-primary">
                        {c.shipment.trackingNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.shipment.client?.name ?? c.shipment.clientName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{CLAIM_TYPE_LABELS[c.type]}</TableCell>
                    <TableCell className="text-sm">{c.title}</TableCell>
                    <TableCell className="text-sm">
                      {c.amountClaimed != null ? formatXOF(c.amountClaimed) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CLAIM_STATUS_TONE[c.status]}>{CLAIM_STATUS_LABELS[c.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell>
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
