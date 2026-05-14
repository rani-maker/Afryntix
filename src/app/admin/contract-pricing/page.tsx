import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatXOF } from "@/lib/utils";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { ContractPricingForm, DeleteContractPriceButton } from "./form";

export default async function AdminContractPricingPage() {
  const [rules, clients] = await Promise.all([
    prisma.clientPricingRule.findMany({
      include: { client: { select: { name: true, email: true } } },
      orderBy: [{ clientId: "asc" }, { mode: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "CLIENT", active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tarification contractuelle par client</CardTitle>
          <CardDescription>
            Ces tarifs remplacent les tarifs standards (PricingRule) pour le client donné. À l&apos;enregistrement
            d&apos;un colis, AFRYNTIX cherche d&apos;abord un tarif contractuel actif avant d&apos;appliquer la grille
            par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractPricingForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarifs actifs ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucun tarif contractuel.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.client.name}</div>
                      <div className="text-xs text-muted-foreground">{r.client.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                    <TableCell className="text-sm">{CARGO_CATEGORY_LABELS[r.category]}</TableCell>
                    <TableCell className="text-sm">{r.unit}</TableCell>
                    <TableCell className="font-medium">{formatXOF(r.pricePerUnit)} / {r.unit}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <DeleteContractPriceButton id={r.id} />
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
