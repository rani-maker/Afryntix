import type {
  ShipmentStatus,
  PaymentStatus,
  ReservationStatus,
  BillPaymentStatus,
} from "@prisma/client";
import { SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { StatusPill, type StatusTone } from "./status-pill";

const SHIPMENT_TONE: Record<ShipmentStatus, StatusTone> = {
  REGISTERED: "info",
  RECEIVED_CHINA: "info",
  IN_TRANSIT: "warning",
  ARRIVED_DESTINATION: "accent",
  CUSTOMS_CLEARANCE: "warning",
  AVAILABLE_FOR_DELIVERY: "success",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function DashShipmentStatusBadge({
  status,
  pulse = false,
}: {
  status: ShipmentStatus;
  pulse?: boolean;
}) {
  return (
    <StatusPill tone={SHIPMENT_TONE[status]} pulse={pulse}>
      {SHIPMENT_STATUS_LABELS[status]}
    </StatusPill>
  );
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Non payé",
  DEPOSIT_PAID: "Acompte 50%",
  FULLY_PAID: "Soldé",
  REFUNDED: "Remboursé",
};
const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  UNPAID: "danger",
  DEPOSIT_PAID: "warning",
  FULLY_PAID: "success",
  REFUNDED: "neutral",
};

export function DashPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <StatusPill tone={PAYMENT_TONE[status]}>{PAYMENT_LABELS[status]}</StatusPill>
  );
}

const RES_LABELS: Record<ReservationStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  REJECTED: "Refusée",
  RECEIVED: "Reçue",
};
const RES_TONE: Record<ReservationStatus, StatusTone> = {
  PENDING: "warning",
  VALIDATED: "info",
  REJECTED: "danger",
  RECEIVED: "success",
};

export function DashReservationStatusBadge({
  status,
}: {
  status: ReservationStatus;
}) {
  return <StatusPill tone={RES_TONE[status]}>{RES_LABELS[status]}</StatusPill>;
}

const BILL_LABELS: Record<BillPaymentStatus, string> = {
  PENDING: "En attente",
  WITHDRAWAL_CODE_SENT: "Code envoyé",
  COMPLETED: "Effectué",
  CANCELLED: "Annulé",
};
const BILL_TONE: Record<BillPaymentStatus, StatusTone> = {
  PENDING: "warning",
  WITHDRAWAL_CODE_SENT: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function DashBillPaymentStatusBadge({
  status,
}: {
  status: BillPaymentStatus;
}) {
  return <StatusPill tone={BILL_TONE[status]}>{BILL_LABELS[status]}</StatusPill>;
}
