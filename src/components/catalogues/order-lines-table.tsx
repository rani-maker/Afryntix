import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATALOG_CATEGORY_LABELS, type CatalogCategoryKey } from "@/lib/catalog-labels";
import { formatXOF } from "@/lib/utils";

export type OrderLine = {
  id: string;
  catalogTitle: string;
  category: CatalogCategoryKey;
  reference: string;
  designation: string;
  page: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

/**
 * Lignes d'une commande catalogue (lecture seule). Les colonnes de prix
 * n'apparaissent qu'une fois le devis établi (`showPrices`).
 */
export function OrderLinesTable({
  items,
  showPrices,
  feesAmount,
  totalAmount,
}: {
  items: OrderLine[];
  showPrices: boolean;
  feesAmount?: number | null;
  totalAmount?: number | null;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Article</TableHead>
            <TableHead>Catalogue</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            {showPrices && <TableHead className="text-right">Prix unitaire</TableHead>}
            {showPrices && <TableHead className="text-right">Total</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="text-sm">
                <div className="font-medium">{i.designation}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {i.reference}
                  {i.page ? ` · p. ${i.page}` : ""}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                <div>{i.catalogTitle}</div>
                <div className="text-xs text-muted-foreground">{CATALOG_CATEGORY_LABELS[i.category]}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
              {showPrices && (
                <TableCell className="text-right tabular-nums">
                  {i.unitPrice != null ? formatXOF(i.unitPrice) : "—"}
                </TableCell>
              )}
              {showPrices && (
                <TableCell className="text-right tabular-nums font-medium">
                  {i.lineTotal != null ? formatXOF(i.lineTotal) : "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
          {showPrices && !!feesAmount && (
            <TableRow>
              <TableCell colSpan={4} className="text-right text-sm">
                Frais annexes (transport, emballage…)
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatXOF(feesAmount)}</TableCell>
            </TableRow>
          )}
          {showPrices && totalAmount != null && (
            <TableRow>
              <TableCell colSpan={4} className="text-right text-sm font-medium">
                Total du devis
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatXOF(totalAmount)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
