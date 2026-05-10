import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddressForm } from "./address-form";
import { AddressRowActions } from "./row-actions";

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  AIR_WAREHOUSE: "Entrepôt aérien",
  SEA_WAREHOUSE: "Entrepôt maritime",
  RECEPTION: "Réception",
  OFFICE: "Bureau",
};

export default async function AdminAddressesPage() {
  const addresses = await prisma.companyAddress.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adresses ({addresses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addresses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucune adresse définie. Créez d'abord les entrepôts en Chine et l'adresse de réception.
                  </TableCell>
                </TableRow>
              ) : (
                addresses.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant="info">{ADDRESS_TYPE_LABELS[a.type] ?? a.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{a.label}</TableCell>
                    <TableCell className="text-sm">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                      <br />
                      <span className="text-muted-foreground">
                        {a.city}, {a.country}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.contactName && <div>{a.contactName}</div>}
                      <div className="text-xs text-muted-foreground">
                        {a.phone ?? ""}
                        {a.whatsapp && a.whatsapp !== a.phone ? ` • WA ${a.whatsapp}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AddressRowActions id={a.id} active={a.active} />
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
