import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InviteStaffForm } from "./invite-staff-form";
import { StaffRowActions } from "./row-actions";
import { formatDateTime } from "@/lib/utils";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const staffWhere: Prisma.UserWhereInput = {
    role: "STAFF",
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [staff, invites] = await Promise.all([
    prisma.user.findMany({
      where: staffWhere,
      orderBy: { createdAt: "desc" },
    }),
    prisma.staffInvite.findMany({
      where: { usedById: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inviter un membre du Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteStaffForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Membres du Staff ({staff.length})</CardTitle>
          <form className="flex gap-2 max-w-md" action="/admin/staff">
            <Input
              name="q"
              defaultValue={search}
              placeholder="Rechercher par nom d'utilisateur, email, téléphone…"
            />
            <Button type="submit" variant="outline">Rechercher</Button>
            {search && (
              <Button asChild variant="ghost">
                <Link href="/admin/staff">Effacer</Link>
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    {search ? `Aucun membre du staff ne correspond à « ${search} ».` : "Aucun staff. Invitez votre premier collaborateur ci-dessus."}
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="destructive">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StaffRowActions userId={u.id} active={u.active} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Invité par</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Lien</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{i.invitedBy.name}</TableCell>
                    <TableCell>{formatDateTime(i.expiresAt)}</TableCell>
                    <TableCell className="font-mono text-xs">/staff-invite/{i.token.slice(0, 16)}…</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
