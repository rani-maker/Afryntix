import { Badge } from "@/components/ui/badge";
import { SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import type { ShipmentStatus, PaymentStatus, ReservationStatus, BillPaymentStatus } from "@prisma/client";

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const map: Record<ShipmentStatus, "default" | "info" | "warning" | "success" | "destructive" | "secondary"> = {
    REGISTERED: "info",
    RECEIVED_CHINA: "info",
    IN_TRANSIT: "warning",
    ARRIVED_DESTINATION: "default",
    CUSTOMS_CLEARANCE: "warning",
    AVAILABLE_FOR_DELIVERY: "success",
    DELIVERED: "success",
    CANCELLED: "destructive",
  };
  return <Badge variant={map[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const labels: Record<PaymentStatus, string> = {
    UNPAID: "Non payé",
    DEPOSIT_PAID: "Acompte 50%",
    FULLY_PAID: "Soldé",
    REFUNDED: "Remboursé",
  };
  const variants: Record<PaymentStatus, "default" | "info" | "warning" | "success" | "destructive" | "secondary"> = {
    UNPAID: "destructive",
    DEPOSIT_PAID: "warning",
    FULLY_PAID: "success",
    REFUNDED: "secondary",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const labels: Record<ReservationStatus, string> = {
    PENDING: "En attente",
    VALIDATED: "Validée",
    REJECTED: "Refusée",
    RECEIVED: "Reçue",
  };
  const variants: Record<ReservationStatus, "default" | "info" | "warning" | "success" | "destructive" | "secondary"> = {
    PENDING: "warning",
    VALIDATED: "info",
    REJECTED: "destructive",
    RECEIVED: "success",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export function BillPaymentStatusBadge({ status }: { status: BillPaymentStatus }) {
  const labels: Record<BillPaymentStatus, string> = {
    PENDING: "En attente",
    WITHDRAWAL_CODE_SENT: "Code envoyé",
    COMPLETED: "Effectué",
    CANCELLED: "Annulé",
  };
  const variants: Record<BillPaymentStatus, "default" | "info" | "warning" | "success" | "destructive" | "secondary"> = {
    PENDING: "warning",
    WITHDRAWAL_CODE_SENT: "info",
    COMPLETED: "success",
    CANCELLED: "destructive",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
