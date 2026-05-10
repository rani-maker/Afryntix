"use client";
import Link from "next/link";
import {
  Package,
  ClipboardList,
  Wallet,
  CheckCircle2,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { StatTile } from "@/components/dashboard/ui/stat-tile";
import {
  DashCard,
  DashCardBody,
  DashCardHeader,
} from "@/components/dashboard/ui/dash-card";
import { DashShipmentStatusBadge } from "@/components/dashboard/ui/dash-status-badge";
import { StatusPill } from "@/components/dashboard/ui/status-pill";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatXOF, formatDate } from "@/lib/utils";
import { useLang } from "@/components/public/public-language-provider";

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

export function DashboardHomeClient({
  totalShipments,
  inTransit,
  available,
  due,
  shipments,
  reservations,
}: {
  totalShipments: number;
  inTransit: number;
  available: number;
  due: number;
  shipments: ShipmentSummary[];
  reservations: ReservationSummary[];
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
