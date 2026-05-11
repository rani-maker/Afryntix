import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShipmentStatusBadge, PaymentStatusBadge } from "./status-badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDate, formatXOF } from "@/lib/utils";
import type { Shipment, ShipmentStatus, PaymentStatus, TransportMode } from "@prisma/client";
import { DeleteShipmentButton } from "./delete-shipment-button";

type Row = Pick<
  Shipment,
  "id" | "trackingNumber" | "mode" | "totalAmount" | "amountPaid" | "createdAt"
> & {
  status: ShipmentStatus;
  paymentStatus: PaymentStatus;
  client?: { name: string; email?: string } | null;
};

export function ShipmentsTable({
  rows,
  showClient = false,
  manageHref,
  showDelete = false,
}: {
  rows: Row[];
  showClient?: boolean;
  manageHref?: (id: string) => string;
  showDelete?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Aucune expédition.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Mode</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Créé le</TableHead>
          {(manageHref || showDelete) && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-mono">
              <Link href={`/tracking/${s.trackingNumber}`} className="hover:text-primary">
                {s.trackingNumber}
              </Link>
            </TableCell>
            {showClient && (
              <TableCell>
                <div className="text-sm font-medium">{s.client?.name ?? "—"}</div>
                {s.client?.email && (
                  <div className="text-xs text-muted-foreground">{s.client.email}</div>
                )}
              </TableCell>
            )}
            <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[s.mode as TransportMode]}</TableCell>
            <TableCell>
              <ShipmentStatusBadge status={s.status} />
            </TableCell>
            <TableCell>
              <PaymentStatusBadge status={s.paymentStatus} />
            </TableCell>
            <TableCell className="text-right">
              <div className="font-medium">{formatXOF(s.totalAmount)}</div>
              {s.amountPaid > 0 && (
                <div className="text-xs text-muted-foreground">
                  Payé : {formatXOF(s.amountPaid)}
                </div>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
            {(manageHref || showDelete) && (
              <TableCell className="text-right">
                <span className="inline-flex items-center justify-end gap-3">
                  {manageHref && (
                    <Link href={manageHref(s.id)} className="text-sm text-primary hover:underline">
                      Gérer
                    </Link>
                  )}
                  {showDelete && <DeleteShipmentButton id={s.id} />}
                </span>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
