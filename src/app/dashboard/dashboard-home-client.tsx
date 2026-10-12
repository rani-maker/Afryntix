"use client";
import Link from "next/link";
import {
  Package,
  ClipboardList,
  Wallet,
  CheckCircle2,
  ArrowUpRight,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { StatTile } from "@/components/dashboard/ui/stat-tile";
import {
  DashCard,
  DashCardBody,
  DashCardHeader,
} from "@/components/dashboard/ui/dash-card";
import { DashShipmentStatusBadge } from "@/components/dashboard/ui/dash-status-badge";
import { StatusPill, type StatusTone } from "@/components/dashboard/ui/status-pill";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatXOF, formatDate } from "@/lib/utils";
import { useLang } from "@/components/public/public-language-provider";
import type { CATALOG_ORDER_ACTIVE_STATUSES } from "@/lib/catalog-labels";
import type { TKey } from "@/lib/i18n";

type ShipmentSummary = {
  id: string;
  trackingNumber: string;
  status: Parameters<typeof DashShipmentStatusBadge>[0]["status"];
  mode: keyof typeof TRANSPORT_MODE_LABELS;
  totalAmount: number;
  createdAt: Date;
};

type ReservationSummary = {
  id: string;
  status: string;
  mode: keyof typeof TRANSPORT_MODE_LABELS;
  supplierTrackingNumber: string | null;
  createdAt: Date;
};

type OrderStatus = (typeof CATALOG_ORDER_ACTIVE_STATUSES)[number];

type OrderSummary = {
  id: string;
  reference: string;
  status: OrderStatus | "DELIVERED" | "CANCELLED";
  createdAt: Date;
  itemCount: number;
  quotedAmount: number | null;
  // Commande passée aux prix affichés : confirmée sans devis
  direct: boolean;
  trackingNumbers: string[];
};

// QUOTED attend une réponse du client : c'est le seul statut mis en avant
const ORDER_STATUS: Record<OrderStatus, { label: TKey; tone: StatusTone }> = {
  PENDING: { label: "dash.home.orders.status.pending", tone: "warning" },
  QUOTED: { label: "dash.home.orders.status.quoted", tone: "accent" },
  CONFIRMED: { label: "dash.home.orders.status.confirmed", tone: "success" },
  IN_PREPARATION: { label: "dash.home.orders.status.in_preparation", tone: "info" },
  SHIPPED: { label: "dash.home.orders.status.shipped", tone: "info" },
};

const pillLink =
  "inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] transition-colors";

export function DashboardHomeClient({
  totalShipments,
  inTransit,
  available,
  due,
  shipments,
  reservations,
  orders,
  ordersInProgress,
}: {
  totalShipments: number;
  inTransit: number;
  available: number;
  due: number;
  shipments: ShipmentSummary[];
  reservations: ReservationSummary[];
  orders: OrderSummary[];
  ordersInProgress: number;
}) {
  const { t } = useLang();

  const recent = (n: number) =>
    n > 1 ? t("dash.home.recent_many") : t("dash.home.recent_one");

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("dash.home.stat.total")}
          value={totalShipments}
          icon={<Package />}
          tone="accent"
        />
        <StatTile
          label={t("dash.home.stat.intransit")}
          value={inTransit}
          icon={<Package />}
          tone="info"
        />
        <StatTile
          label={t("dash.home.stat.available")}
          value={available}
          icon={<CheckCircle2 />}
          tone="success"
          hint={t("dash.home.stat.available_hint")}
        />
        <StatTile
          label={t("dash.home.stat.due")}
          value={formatXOF(due)}
          icon={<Wallet />}
          tone={due > 0 ? "warning" : "neutral"}
        />
      </div>

      <DashCard>
        <DashCardHeader
          icon={<ShoppingBag />}
          title={t("dash.home.orders.title")}
          subtitle={`${ordersInProgress} ${t("dash.home.orders.in_progress")}`}
          action={
            <Link href="/dashboard/orders" className={pillLink}>
              {t("dash.home.see_all")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <DashCardBody>
          {orders.length === 0 ? (
            <div className="py-2">
              <p className="text-sm text-[var(--dash-text-muted)]">{t("dash.home.orders.empty")}</p>
              <Link
                href="/dashboard/catalogue"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-accent))] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 transition-opacity"
              >
                {t("dash.home.orders.browse")}
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--dash-border)] -mx-1">
              {orders.map((o) => {
                const st = o.status in ORDER_STATUS ? ORDER_STATUS[o.status as OrderStatus] : null;
                return (
                  <li
                    key={o.id}
                    className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 px-1 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="min-w-0">
                      <Link
                        href="/dashboard/orders"
                        className="font-mono text-[13px] font-semibold text-[var(--dash-text)] hover:text-[hsl(var(--dash-accent))] transition-colors"
                      >
                        {o.reference}
                      </Link>
                      <div className="text-xs text-[var(--dash-text-muted)] mt-0.5">
                        {o.itemCount}{" "}
                        {o.itemCount > 1 ? t("dash.home.orders.items_many") : t("dash.home.orders.items_one")} •{" "}
                        {formatDate(o.createdAt)}
                      </div>
                      {o.trackingNumbers.length > 0 && (
                        <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {o.trackingNumbers.map((n) => (
                            <Link
                              key={n}
                              href={`/tracking/${n}`}
                              className="font-mono text-[hsl(var(--dash-accent))] hover:underline"
                            >
                              {t("dash.home.orders.track")} {n}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1.5 shrink-0 ml-auto">
                      {st && (
                        <StatusPill tone={st.tone} pulse={o.status === "QUOTED"}>
                          {t(o.direct && o.status === "CONFIRMED" ? "dash.home.orders.status.ordered" : st.label)}
                        </StatusPill>
                      )}
                      {o.quotedAmount != null && (
                        <div className="text-xs text-[var(--dash-text-dim)] tabular-nums">
                          {t(o.direct ? "dash.home.orders.total" : "dash.home.orders.quote")}{" "}
                          {formatXOF(o.quotedAmount)}
                        </div>
                      )}
                      {o.status === "QUOTED" && (
                        <div>
                          <Link
                            href="/dashboard/orders"
                            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-accent))] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 transition-opacity"
                          >
                            {t("dash.home.orders.answer")} <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DashCardBody>
      </DashCard>

      <div className="grid lg:grid-cols-2 gap-5">
        <DashCard>
          <DashCardHeader
            icon={<Package />}
            title={t("dash.home.shipments.title")}
            subtitle={`${shipments.length} ${recent(shipments.length)}`}
            action={
              <Link
                href="/dashboard/shipments"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] transition-colors"
              >
                {t("dash.home.see_all")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <DashCardBody>
            {shipments.length === 0 ? (
              <p className="text-sm text-[var(--dash-text-muted)] py-4">
                {t("dash.home.shipments.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--dash-border)] -mx-1">
                {shipments.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between items-center gap-3 px-1 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/tracking/${s.trackingNumber}`}
                        className="font-mono text-[13px] font-semibold text-[var(--dash-text)] hover:text-[hsl(var(--dash-accent))] transition-colors"
                      >
                        {s.trackingNumber}
                      </Link>
                      <div className="text-xs text-[var(--dash-text-muted)] mt-0.5">
                        {TRANSPORT_MODE_LABELS[s.mode]} • {formatDate(s.createdAt)}
                      </div>
                    </div>
                    <div className="text-right space-y-1.5 shrink-0">
                      <DashShipmentStatusBadge status={s.status} />
                      <div className="text-xs text-[var(--dash-text-dim)] tabular-nums">
                        {formatXOF(s.totalAmount)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashCardBody>
        </DashCard>

        <DashCard>
          <DashCardHeader
            icon={<ClipboardList />}
            title={t("dash.home.reservations.title")}
            subtitle={`${reservations.length} ${recent(reservations.length)}`}
            action={
              <Link
                href="/dashboard/reservations"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] transition-colors"
              >
                {t("dash.home.see_all")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <DashCardBody>
            {reservations.length === 0 ? (
              <div className="py-2">
                <p className="text-sm text-[var(--dash-text-muted)]">
                  {t("dash.home.reservations.empty")}
                </p>
                <Link
                  href="/dashboard/reservations/new"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-accent))] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("dash.home.reservations.book")}
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--dash-border)] -mx-1">
                {reservations.map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between items-center gap-3 px-1 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--dash-text)]">
                        {TRANSPORT_MODE_LABELS[r.mode]}
                      </div>
                      <div className="text-xs text-[var(--dash-text-muted)] mt-0.5 truncate">
                        {t("dash.home.reservations.supplier")}{" "}
                        <span className="font-mono">
                          {r.supplierTrackingNumber || "—"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusPill tone="info">{r.status}</StatusPill>
                      <div className="text-xs text-[var(--dash-text-dim)] mt-1.5">
                        {formatDate(r.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashCardBody>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader
          icon={<Wallet />}
          title={t("dash.home.payments.title")}
          subtitle={
            due > 0
              ? t("dash.home.payments.action_required")
              : t("dash.home.payments.uptodate")
          }
        />
        <DashCardBody>
          {due <= 0 ? (
            <p className="text-sm text-[var(--dash-text-muted)] py-2">
              {t("dash.home.payments.none")}
            </p>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="text-sm text-[var(--dash-text)]">
                  {t("dash.home.payments.due_pre")}{" "}
                  <span className="font-bold text-amber-300 tabular-nums">
                    {formatXOF(due)}
                  </span>{" "}
                  {t("dash.home.payments.due_post")}
                </div>
              </div>
            </div>
          )}
        </DashCardBody>
      </DashCard>
    </div>
  );
}
