import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS, DEFAULT_PRICING } from "@/lib/pricing";
import { formatXOF } from "@/lib/utils";
import { PricingForm } from "./pricing-form";

export default async function AdminPricingPage() {
  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ mode: "asc" }, { category: "asc" }],
  });

  const defaultRows: Array<{ mode: string; category: string; unit: string; price: number; note?: string }> = [];
  for (const [mode, byCat] of Object.entries(DEFAULT_PRICING)) {
    for (const [cat, rule] of Object.entries(byCat as Record<string, { unit: string; price: number; priceFrom5CBM?: number }>)) {
      defaultRows.push({
        mode,
        category: cat,
        unit: rule.unit,
        price: rule.price,
        note: "priceFrom5CBM" in rule && rule.priceFrom5CBM ? `Dégressif ≥ 5 CBM : ${formatXOF(rule.priceFrom5CBM)}` : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personnaliser un tarif</CardTitle>
          <CardDescription>
            Ces règles écrasent les tarifs par défaut pour le couple Mode + Catégorie + Unité.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PricingForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarifs personnalisés ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead>Quantité min.</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucun tarif personnalisé. Le moteur utilise la grille par défaut ci-dessous.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                    <TableCell className="text-sm">{CARGO_CATEGORY_LABELS[r.category]}</TableCell>
                    <TableCell className="text-sm">{r.unit}</TableCell>
                    <TableCell className="text-right">{formatXOF(r.pricePerUnit)}</TableCell>
                    <TableCell className="text-sm">{r.minQuantity ?? "—"}</TableCell>
                    <TableCell>
                      {r.active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grille tarifaire par défaut</CardTitle>
          <CardDescription>Référence interne — utilisée si aucun tarif personnalisé.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaultRows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[r.mode as keyof typeof TRANSPORT_MODE_LABELS]}</TableCell>
                  <TableCell className="text-sm">{CARGO_CATEGORY_LABELS[r.category as keyof typeof CARGO_CATEGORY_LABELS]}</TableCell>
                  <TableCell className="text-sm">{r.unit}</TableCell>
                  <TableCell className="text-right">{r.price > 0 ? formatXOF(r.price) : "Sur devis"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
