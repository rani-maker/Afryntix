"use client";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShoppingBag } from "lucide-react";
import { ChartTooltip } from "./charts";

const RECEIVED = "#0ea5e9";
const VALIDATED = "#00a481";
const label = { fill: "var(--afx-ink-2)", fontSize: 11, fontWeight: 600 };
// Pas d'étiquette « 0 » au-dessus d'une barre absente
const hideZero = (v: number) => (v > 0 ? v : "");

export function OrderCharts({
  monthly,
  byStatus,
}: {
  monthly: Array<{ month: string; received: number; validated: number }>;
  byStatus: Array<{ name: string; value: number }>;
}) {
  const received = monthly.reduce((n, m) => n + m.received, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-mint-3" />
              Commandes par mois
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Reçues et validées — 6 derniers mois</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">{received}</div>
            <div className="text-[11px] text-muted-foreground">reçues</div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 18, right: 8, left: -16, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  interval={0}
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
                <Bar dataKey="received" name="Reçues" fill={RECEIVED} radius={[8, 8, 0, 0]} maxBarSize={28}>
                  <LabelList dataKey="received" position="top" formatter={hideZero} style={label} />
                </Bar>
                <Bar dataKey="validated" name="Validées" fill={VALIDATED} radius={[8, 8, 0, 0]} maxBarSize={28}>
                  <LabelList dataKey="validated" position="top" formatter={hideZero} style={label} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: RECEIVED }} />
              Reçues
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: VALIDATED }} />
              Validées (devis accepté)
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-mint-3" />
            Commandes par statut
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Du bon de commande à la livraison</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--afx-line)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--afx-ink-3)" }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--afx-ink-2)" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--afx-mint)", fillOpacity: 0.06 }} />
                <Bar dataKey="value" name="Commandes" fill={VALIDATED} radius={[0, 8, 8, 0]} maxBarSize={22}>
                  <LabelList dataKey="value" position="right" style={label} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
