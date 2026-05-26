import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  AIR_EXPRESS: "Aérien Express",
  AIR_NORMAL: "Aérien Normal",
  SEA_LCL: "Maritime LCL",
  SEA_FCL: "Maritime FCL",
  VEHICLE: "Véhicule",
  BTP_EQUIPMENT: "BTP",
  STORAGE: "Entreposage",
};

export default async function AgentWarehousePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true, companyName: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "AGENT_CHINE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section réservée aux agents Chine</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette page n'est disponible que pour les partenaires de type « Agent Chine ».
          </p>
        </CardContent>
      </Card>
    );
  }

  // Files à traiter
  const [toReceive, receivedToday, receivedThisMonth] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: "VALIDATED" },
      orderBy: { validatedAt: "desc" },
      take: 100,
      include: { client: { select: { name: true, phone: true } } },
    }),
    prisma.auditLog.count({
      where: {
        action: "AGENT_RECEIVED_RESERVATION",
        userId: session.user.id,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: "AGENT_RECEIVED_RESERVATION",
        userId: session.user.id,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">À réceptionner</div>
            <div className="text-2xl font-semibold mt-1 text-amber-700">{toReceive.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Colis annoncés en attente</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Réceptionnés aujourd'hui</div>
            <div className="text-2xl font-semibold mt-1">{receivedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Réceptionnés ce mois</div>
            <div className="text-2xl font-semibold mt-1">{receivedThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File de réception ({toReceive.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Colis annoncés par les clients via leur réservation. Cliquez sur « Réceptionner » pour peser, mesurer et créer le colis officiel.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking fournisseur</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Poids déclaré</TableHead>
                <TableHead>Validée le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {toReceive.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun colis en attente de réception.
                  </TableCell>
                </TableRow>
              ) : (
                toReceive.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.supplierTrackingNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.client.name}</div>
                      <div className="text-xs text-muted-foreground">{r.client.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.recipientName ?? "—"}</TableCell>
                    <TableCell><Badge variant="info">{MODE_LABELS[r.mode]}</Badge></TableCell>
                    <TableCell className="text-right text-sm">
                      {r.estimatedWeightKg != null ? `${r.estimatedWeightKg} kg` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.validatedAt ? formatDateTime(r.validatedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link href={`/partner/warehouse/${r.id}`}>Réceptionner</Link>
                      </Button>
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
