import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreatePartnerForm } from "./create-partner-form";
import { PartnerRowActions } from "./row-actions";
import { formatDateTime, formatXOF } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  APPORTEUR: "Apporteur",
  REVENDEUR: "Revendeur",
  TRANSPORTEUR_RELAIS: "Transp. relais",
  AGENT_CHINE: "Agent Chine",
  CONFRERE_FORWARDER: "Confrère",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "destructive",
  TERMINATED: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente KYC",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  TERMINATED: "Résilié",
};

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const { q, type, status } = await searchParams;
  const search = q?.trim() ?? "";

  const where: Prisma.PartnerWhereInput = {
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
            { contactPhone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { referralCode: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(type ? { type: type as Prisma.PartnerWhereInput["type"] } : {}),
    ...(status ? { status: status as Prisma.PartnerWhereInput["status"] } : {}),
  };

  const [partners, stats] = await Promise.all([
    prisma.partner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { shipmentsReferred: true } },
      },
    }),
    prisma.partner.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const totalBalance = partners.reduce((sum, p) => sum + p.balance, 0);
  const totalActive = stats.find((s) => s.status === "ACTIVE")?._count._all ?? 0;
  const totalPending = stats.find((s) => s.status === "PENDING")?._count._all ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Partenaires actifs</div>
            <div className="text-2xl font-semibold mt-1">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">En attente KYC</div>
            <div className="text-2xl font-semibold mt-1 text-amber-700">{totalPending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total partenaires</div>
            <div className="text-2xl font-semibold mt-1">{partners.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Solde dû global</div>
            <div className="text-2xl font-semibold mt-1">{formatXOF(totalBalance)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enregistrer un nouveau partenaire</CardTitle>
        </CardHeader>
        <CardContent>
          <CreatePartnerForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Partenaires ({partners.length})</CardTitle>
          <form className="flex flex-wrap gap-2" action="/admin/partners">
            <Input
              name="q"
              defaultValue={search}
              placeholder="Rechercher (nom, contact, téléphone, code…)"
              className="max-w-sm"
            />
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tous les types</option>
              <option value="APPORTEUR">Apporteur</option>
              <option value="REVENDEUR">Revendeur</option>
              <option value="TRANSPORTEUR_RELAIS">Transporteur relais</option>
              <option value="AGENT_CHINE">Agent Chine</option>
              <option value="CONFRERE_FORWARDER">Confrère forwarder</option>
            </select>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tous statuts</option>
              <option value="PENDING">En attente KYC</option>
              <option value="ACTIVE">Actif</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="TERMINATED">Résilié</option>
            </select>
            <Button type="submit" variant="outline">Filtrer</Button>
            {(search || type || status) && (
              <Button asChild variant="ghost">
                <Link href="/admin/partners">Effacer</Link>
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Société / Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Code parrain</TableHead>
                <TableHead>Colis</TableHead>
                <TableHead>Solde dû</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {search || type || status
                      ? "Aucun partenaire ne correspond aux filtres."
                      : "Aucun partenaire. Enregistrez votre premier partenaire ci-dessus."}
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/admin/partners/${p.id}`} className="hover:underline">
                        {p.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/partners/${p.id}`} className="hover:underline">
                        <div className="font-medium">{p.companyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.contactName} · {p.contactPhone}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{TYPE_LABELS[p.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.city}
                      <div className="text-xs text-muted-foreground">{p.country}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.referralCode}</TableCell>
                    <TableCell className="text-sm">{p._count.shipmentsReferred}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {p.balance > 0 ? formatXOF(p.balance) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <PartnerRowActions partnerId={p.id} status={p.status} />
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
