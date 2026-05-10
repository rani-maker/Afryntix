import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function AdminAuditPage() {
  const [notifs, logs] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications WhatsApp ({notifs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Aucune notification.
                  </TableCell>
                </TableRow>
              ) : (
                notifs.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono">{n.template}</TableCell>
                    <TableCell className="text-xs">
                      {n.user?.name ?? n.to}
                      <div className="text-muted-foreground">{n.to}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          n.status === "SENT" ? "success" : n.status === "FAILED" ? "destructive" : "warning"
                        }
                      >
                        {n.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{n.error ?? ""}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Pas encore de logs.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell className="text-sm">{l.user?.name ?? "système"}</TableCell>
                    <TableCell className="text-xs font-mono">{l.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.entity}
                      {l.entityId ? ` #${l.entityId.slice(0, 8)}` : ""}
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
