import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/stats-card";
import { StatisticsCharts } from "./charts";
import { TRANSPORT_MODE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/pricing";
import { formatXOF } from "@/lib/utils";
import { Banknote, Package, ClipboardList, CreditCard } from "lucide-react";

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default async function AdminStatisticsPage() {
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [shipments, paid, byMode, byStatus, monthlyShipments, payments, monthlyPayments] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.aggregate({ _sum: { amountPaid: true } }),
    prisma.shipment.groupBy({ by: ["mode"], _count: true }),
    prisma.shipment.groupBy({ by: ["status"], _count: true }),
    prisma.shipment.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, mode: true, totalAmount: true, amountPaid: true },
    }),
    prisma.billPayment.count(),
    prisma.billPayment.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: {
        createdAt: true,
        type: true,
        amountSource: true,
        sourceCurrency: true,
        amountTarget: true,
        targetCurrency: true,
      },
    }),
  ]);

  // Build monthly buckets for last 6 months — split by package category
  type MonthlyBucket = {
    count: number;
    revenue: number;
    express: number;
    normal: number;
    maritime: number;
    other: number;
  };
  const monthlyMap = new Map<string, MonthlyBucket>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, { count: 0, revenue: 0, express: 0, normal: 0, maritime: 0, other: 0 });
  }
  for (const s of monthlyShipments) {
    const ms = startOfMonth(s.createdAt);
    const key = `${ms.getUTCFullYear()}-${String(ms.getUTCMonth() + 1).padStart(2, "0")}`;
    const prev = monthlyMap.get(key);
    if (!prev) continue;
    prev.count += 1;
    prev.revenue += s.amountPaid;
    switch (s.mode) {
      case "AIR_EXPRESS":
        prev.express += 1;
        break;
      case "AIR_NORMAL":
        prev.normal += 1;
        break;
      case "SEA_LCL":
      case "SEA_FCL":
        prev.maritime += 1;
        break;
      default:
        prev.other += 1;
    }
  }
  const monthly = Array.from(monthlyMap.entries()).map(([k, v]) => {
    const [y, m] = k.split("-");
    const labelDate = new Date(Number(y), Number(m) - 1, 1);
    return {
      month: labelDate.toLocaleString("fr-FR", { month: "short", year: "2-digit" }),
      shipments: v.count,
      revenue: v.revenue,
      express: v.express,
      normal: v.normal,
      maritime: v.maritime,
      other: v.other,
    };
  });

  const modeData = byMode.map((g) => ({
    name: TRANSPORT_MODE_LABELS[g.mode],
    value: g._count,
  }));
  const statusData = byStatus.map((g) => ({
    name: SHIPMENT_STATUS_LABELS[g.status],
    value: g._count,
  }));

  // Build monthly buckets for last 6 months — transferts & paiements de factures
  type PaymentBucket = {
    transfers: number;
    bills: number;
    volumeXOF: number;
    volumeCNY: number;
  };
  const paymentMap = new Map<string, PaymentBucket>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    paymentMap.set(key, { transfers: 0, bills: 0, volumeXOF: 0, volumeCNY: 0 });
  }
  for (const p of monthlyPayments) {
    const ms = startOfMonth(p.createdAt);
    const key = `${ms.getUTCFullYear()}-${String(ms.getUTCMonth() + 1).padStart(2, "0")}`;
    const prev = paymentMap.get(key);
    if (!prev) continue;
    if (p.type === "MONEY_TRANSFER") prev.transfers += 1;
    else prev.bills += 1;
    if (p.sourceCurrency === "XOF") prev.volumeXOF += p.amountSource;
    else if (p.targetCurrency === "XOF") prev.volumeXOF += p.amountTarget;
    if (p.sourceCurrency === "RMB") prev.volumeCNY += p.amountSource;
    else if (p.targetCurrency === "RMB") prev.volumeCNY += p.amountTarget;
  }
  const monthlyPaymentsData = Array.from(paymentMap.entries()).map(([k, v]) => {
    const [y, m] = k.split("-");
    const labelDate = new Date(Number(y), Number(m) - 1, 1);
    return {
      month: labelDate.toLocaleString("fr-FR", { month: "short", year: "2-digit" }),
      transfers: v.transfers,
      bills: v.bills,
      volumeXOF: v.volumeXOF,
      volumeCNY: v.volumeCNY,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total expéditions"
          value={shipments}
          icon={<Package />}
          href="/admin/shipments"
        />
        <StatsCard
          label="CA encaissé"
          value={formatXOF(paid._sum.amountPaid ?? 0)}
          tone="success"
          icon={<Banknote />}
          href="/admin/shipments"
        />
        <StatsCard
          label="Réservations"
          value={byStatus.reduce((a, b) => a + b._count, 0)}
          icon={<ClipboardList />}
          href="/admin/reservations"
        />
        <StatsCard
          label="Transferts"
          value={payments}
          icon={<CreditCard />}
          href="/admin/payments"
        />
      </div>

      <StatisticsCharts
        monthly={monthly}
        byMode={modeData}
        byStatus={statusData}
        monthlyPayments={monthlyPaymentsData}
      />
    </div>
  );
}
