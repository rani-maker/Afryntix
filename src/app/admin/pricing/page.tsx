import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS, DEFAULT_PRICING } from "@/lib/pricing";
import { formatXOF } from "@/lib/utils";
import { PricingManager } from "./pricing-manager";

export default async function AdminPricingPage() {
  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ mode: "asc" }, { category: "asc" }, { minQuantity: "asc" }],
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
      <PricingManager rules={rules} />

      <Card>
        <CardHeader>
          <CardTitle>Grille tarifaire par défaut</CardTitle>
          <CardDescription>
            Référence interne — utilisée si aucun tarif personnalisé n&apos;existe pour le couple
            Mode + Catégorie. Vous pouvez écraser n&apos;importe quelle ligne via le formulaire ci-dessus.
          </CardDescription>
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
