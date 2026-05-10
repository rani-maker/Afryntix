"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, Layers, Activity, CreditCard } from "lucide-react";

const PALETTE = [
  "#00a481",
  "#00c79a",
  "#00e2b1",
  "#5eead4",
  "#22d3ee",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
];

function formatCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg backdrop-blur">
      {label && <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span className="text-ink-2">{p.name}</span>
            <span className="font-semibold text-ink ml-auto">
              {formatter ? formatter(p.value) : p.value.toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatisticsCharts({
  monthly,
  byMode,
  byStatus,
  monthlyPayments,
}: {
  monthly: Array<{
    month: string;
    shipments: number;
    revenue: number;
    express: number;
    normal: number;
    maritime: number;
    other: number;
  }>;
  byMode: Array<{ name: string; value: number }>;
  byStatus: Array<{ name: string; value: number }>;
  monthlyPayments: Array<{
    month: string;
    transfers: number;
    bills: number;
    volumeXOF: number;
    volumeCNY: number;
  }>;
}) {
  const totalTransfers = useMemo(
    () => monthlyPayments.reduce((a, b) => a + b.transfers, 0),
    [monthlyPayments],
  );
  const totalBills = useMemo(
    () => monthlyPayments.reduce((a, b) => a + b.bills, 0),
    [monthlyPayments],
  );
  const totalVolumeXOF = useMemo(
    () => monthlyPayments.reduce((a, b) => a + b.volumeXOF, 0),
    [monthlyPayments],
  );
  const totalVolumeCNY = useMemo(
    () => monthlyPayments.reduce((a, b) => a + b.volumeCNY, 0),
    [monthlyPayments],
  );
  const totalShipments = useMemo(
    () => monthly.reduce((a, b) => a + b.shipments, 0),
    [monthly],
  );
  const totalRevenue = useMemo(
    () => monthly.reduce((a, b) => a + b.revenue, 0),
    [monthly],
  );
  const totalByMode = useMemo(
    () => byMode.reduce((a, b) => a + b.value, 0),
    [byMode],
  );

  const lastTwo = monthly.slice(-2);
  const trendPct = useMemo(() => {
    if (lastTwo.length < 2 || lastTwo[0].shipments === 0) return null;
    return ((lastTwo[1].shipments - lastTwo[0].shipments) / lastTwo[0].shipments) * 100;
  }, [lastTwo]);

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Colis par mois — Stacked bars: Express / Normal / Maritime */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-mint-3" />
              Colis par mois
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Évolution Express / Normal / Maritime — 6 derniers mois
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">{totalShipments}</div>
            {trendPct !== null && (
              <div
                className={`text-[11px] font-semibold flex items-center gap-1 justify-end ${
                  trendPct >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                <TrendingUp className={`h-3 w-3 ${trendPct < 0 ? "rotate-180" : ""}`} />
                {trendPct >= 0 ? "+" : ""}
                {trendPct.toFixed(1)}%
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }} />
                <Bar dataKey="express" stackId="ship" name="Express" fill="#00a481" radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="normal" stackId="ship" name="Normal" fill="#22d3ee" radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="maritime" stackId="ship" name="Maritime" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#00a481" }} />Express</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#22d3ee" }} />Normal</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0ea5e9" }} />Maritime</li>
          </ul>
        </CardContent>
      </Card>

      {/* CA encaissé — Bar with gradient */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-mint-3" />
              Chiffre d&apos;affaires
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Encaissements mensuels (FCFA)</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">
              {formatCompact(totalRevenue)}
              <span className="text-xs font-normal text-muted-foreground ml-1">FCFA</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e2b1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#00a481" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                  width={40}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v: number) => `${v.toLocaleString("fr-FR")} FCFA`}
                    />
                  }
                  cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }}
                />
                <Bar
                  dataKey="revenue"
                  name="Encaissé"
                  fill="url(#revFill)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Répartition par mode — Donut with center total */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-mint-3" />
            Répartition par mode
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Volume par mode de transport</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byMode}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--afx-surface)"
                    strokeWidth={2}
                  >
                    {byMode.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v: number) =>
                          `${v} (${totalByMode ? ((v / totalByMode) * 100).toFixed(1) : 0}%)`
                        }
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-2xl font-bold tracking-tight">{totalByMode}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total
                </div>
              </div>
            </div>
            <ul className="flex flex-col gap-2 min-w-[140px]">
              {byMode.map((m, i) => (
                <li key={m.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    aria-hidden="true"
                  />
                  <span className="text-ink-2 truncate">{m.name}</span>
                  <span className="font-semibold text-ink ml-auto">{m.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Répartition par statut — Horizontal bar with embedded labels */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-mint-3" />
            Répartition par statut
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Pipeline des expéditions</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byStatus}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="statusFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00a481" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#00e2b1" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--afx-line)"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={170}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--afx-ink-2)" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }} />
                <Bar
                  dataKey="value"
                  name="Expéditions"
                  fill="url(#statusFill)"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={22}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: "var(--afx-ink-2)", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Tableau récapitulatif par mois */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-mint-3" />
            Récapitulatif mensuel des colis
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Détail par mode de transport — 6 derniers mois
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Mois</th>
                <th className="text-right px-4 py-2 font-medium">Express</th>
                <th className="text-right px-4 py-2 font-medium">Normal</th>
                <th className="text-right px-4 py-2 font-medium">Maritime</th>
                <th className="text-right px-4 py-2 font-medium">Autres</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-right px-4 py-2 font-medium">CA encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {monthly.map((m) => (
                <tr key={m.month} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium capitalize">{m.month}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.express}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.normal}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.maritime}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{m.other}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{m.shipments}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.revenue.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">FCFA</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-line">
              <tr className="font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{monthly.reduce((a, b) => a + b.express, 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{monthly.reduce((a, b) => a + b.normal, 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{monthly.reduce((a, b) => a + b.maritime, 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{monthly.reduce((a, b) => a + b.other, 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalShipments}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totalRevenue.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">FCFA</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Transferts & Paiements de factures — chart empilé */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-mint-3" />
                Transferts & Paiements de factures
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Évolution mensuelle — Transferts vs Factures
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight">{totalTransfers + totalBills}</div>
              <div className="text-[11px] text-muted-foreground">
                {totalTransfers} transferts · {totalBills} factures
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPayments} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }} />
                  <Bar dataKey="transfers" stackId="pay" name="Transferts" fill="#00a481" maxBarSize={48} />
                  <Bar dataKey="bills" stackId="pay" name="Factures" fill="#f59e0b" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#00a481" }} />Transferts</li>
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} />Factures</li>
            </ul>
          </CardContent>
        </Card>

        {/* Volumes par devise */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-mint-3" />
              Volume mensuel par devise
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Montants traités (toutes catégories confondues)
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPayments} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                  />
                  <YAxis
                    tickFormatter={formatCompact}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                    width={48}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v: number) => v.toLocaleString("fr-FR")}
                      />
                    }
                    cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }}
                  />
                  <Bar dataKey="volumeXOF" name="XOF" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="volumeCNY" name="CNY" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0ea5e9" }} />XOF · {totalVolumeXOF.toLocaleString("fr-FR")}</li>
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />CNY · {totalVolumeCNY.toLocaleString("fr-FR")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Récap mensuel transferts */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-mint-3" />
            Récapitulatif mensuel des transferts & factures
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Détail par mois — 6 derniers mois
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Mois</th>
                <th className="text-right px-4 py-2 font-medium">Transferts</th>
                <th className="text-right px-4 py-2 font-medium">Factures</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-right px-4 py-2 font-medium">Volume XOF</th>
                <th className="text-right px-4 py-2 font-medium">Volume CNY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {monthlyPayments.map((m) => (
                <tr key={m.month} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium capitalize">{m.month}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.transfers}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.bills}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{m.transfers + m.bills}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.volumeXOF.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">XOF</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.volumeCNY.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">CNY</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-line">
              <tr className="font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalTransfers}</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalBills}</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalTransfers + totalBills}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totalVolumeXOF.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">XOF</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totalVolumeCNY.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">CNY</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
