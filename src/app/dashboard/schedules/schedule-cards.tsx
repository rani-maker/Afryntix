"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import { getCapacityUnit, CAPACITY_UNIT_LABEL } from "@/lib/schedule-capacity";
import {
  Plane,
  Ship,
  Car,
  HardHat,
  Warehouse,
  CalendarDays,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import type { TransportMode } from "@prisma/client";

type Schedule = {
  id: string;
  mode: TransportMode;
  origin: string;
  destination: string;
  departureDate: Date;
  arrivalDate: Date | null;
  cutoffDate: Date;
  capacity: string | null;
  capacityValue: number | null;
  notes: string | null;
  reservationCount: number;
  occupancy: {
    used: number;
    capacity: number;
    remaining: number;
    isFull: boolean;
    percent: number;
  } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  TransportMode,
  { icon: React.ReactNode; color: string; border: string; badge: string }
> = {
  AIR_EXPRESS: {
    icon: <Plane className="h-4 w-4" />,
    color: "text-orange-600",
    border: "border-l-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  AIR_NORMAL: {
    icon: <Plane className="h-4 w-4" />,
    color: "text-blue-600",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  SEA_LCL: {
    icon: <Ship className="h-4 w-4" />,
    color: "text-cyan-600",
    border: "border-l-cyan-500",
    badge: "bg-cyan-100 text-cyan-700",
  },
  SEA_FCL: {
    icon: <Ship className="h-4 w-4" />,
    color: "text-teal-700",
    border: "border-l-teal-600",
    badge: "bg-teal-100 text-teal-700",
  },
  VEHICLE: {
    icon: <Car className="h-4 w-4" />,
    color: "text-zinc-600",
    border: "border-l-zinc-400",
    badge: "bg-zinc-100 text-zinc-700",
  },
  BTP_EQUIPMENT: {
    icon: <HardHat className="h-4 w-4" />,
    color: "text-yellow-700",
    border: "border-l-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
  },
  STORAGE: {
    icon: <Warehouse className="h-4 w-4" />,
    color: "text-purple-600",
    border: "border-l-purple-500",
    badge: "bg-purple-100 text-purple-700",
  },
};

const ALL_MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Component ─────────────────────────────────────────────────────────────────

type NextSuggestion = { id: string; departureDate: Date } | null;

export function ScheduleCards({
  schedules,
  now,
  nextSuggestions = {},
}: {
  schedules: Schedule[];
  now: Date;
  // Pour chaque calendrier plein, prochain départ disponible du même mode.
  nextSuggestions?: Record<string, NextSuggestion>;
}) {
  const [activeMode, setActiveMode] = useState<TransportMode | "ALL">("ALL");

  // Modes présents dans les données
  const modesInData = ALL_MODES.filter((m) => schedules.some((s) => s.mode === m));

  const filtered =
    activeMode === "ALL" ? schedules : schedules.filter((s) => s.mode === activeMode);

  const open = filtered.filter((s) => s.cutoffDate >= now);
  const closed = filtered.filter((s) => s.cutoffDate < now);

  return (
    <div className="space-y-6">
      {/* ── Filtres mode ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveMode("ALL")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
            activeMode === "ALL"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
          }`}
        >
          Tous les départs
        </button>
        {modesInData.map((m) => {
          const cfg = MODE_CONFIG[m];
          return (
            <button
              key={m}
              onClick={() => setActiveMode(m)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                activeMode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              <span className={activeMode === m ? "" : cfg.color}>{cfg.icon}</span>
              {TRANSPORT_MODE_LABELS[m]}
            </button>
          );
        })}
      </div>

      {/* ── Départs ouverts ───────────────────────────────────────────────── */}
      {open.length === 0 && closed.length === 0 && (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <CalendarDays className="mx-auto h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucun départ programmé pour le moment.</p>
          <p className="text-xs mt-1">Notre équipe publiera prochainement les prochains calendriers.</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Prochains départs ({open.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                now={now}
                closed={false}
                nextSuggestion={nextSuggestions[s.id] ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Départs fermés (cutoff dépassé) ───────────────────────────────── */}
      {closed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Départs passés ({closed.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 opacity-60">
            {closed.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                now={now}
                closed={true}
                nextSuggestion={null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card individuelle ─────────────────────────────────────────────────────────

function ScheduleCard({
  schedule: s,
  now,
  closed,
  nextSuggestion,
}: {
  schedule: Schedule;
  now: Date;
  closed: boolean;
  nextSuggestion: NextSuggestion;
}) {
  const cfg = MODE_CONFIG[s.mode];
  const daysLeft = daysUntil(s.cutoffDate, now);
  const isUrgent = !closed && daysLeft <= 5;
  // Occupation pré-calculée côté serveur (CBM pour maritime, kg pour aérien,
  // unités sinon). null = pas de plafond défini par l'admin.
  const occ = s.occupancy;
  const isFull = !!occ?.isFull;
  const unitLabel = CAPACITY_UNIT_LABEL[getCapacityUnit(s.mode)];

  return (
    <Card className={`border-l-4 ${cfg.border} flex flex-col`}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className={`flex items-center gap-1.5 font-semibold text-sm ${cfg.color}`}>
            {cfg.icon}
            <span>{TRANSPORT_MODE_LABELS[s.mode]}</span>
          </div>
          {closed ? (
            <Badge variant="secondary" className="text-[11px]">Fermé</Badge>
          ) : isFull ? (
            <Badge variant="destructive" className="text-[11px]">Complet</Badge>
          ) : isUrgent ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <AlertCircle className="h-3 w-3" />
              {daysLeft <= 0 ? "Dernier jour" : `${daysLeft}j restants`}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Cutoff dans {daysLeft}j
            </span>
          )}
        </div>

        {/* Route */}
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{s.origin}</span>
          <span className="text-muted-foreground">→</span>
          <span>{s.destination}</span>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <CalendarDays className="h-3 w-3" /> Départ
            </p>
            <p className="font-medium">{formatDate(s.departureDate)}</p>
          </div>

          {s.arrivalDate ? (
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
                <CalendarDays className="h-3 w-3" /> Arrivée est.
              </p>
              <p className="font-medium">{formatDate(s.arrivalDate)}</p>
            </div>
          ) : (
            <div />
          )}

          <div className="col-span-2">
            <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Clock className="h-3 w-3" /> Limite de réservation
            </p>
            <p className={`font-medium ${isUrgent ? "text-amber-600" : ""}`}>
              {formatDate(s.cutoffDate)}
            </p>
          </div>
        </div>

        {/* Occupation : barre + valeur dans l'unité du mode si plafond défini */}
        {occ && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                📦 {unitLabel === "m³" ? "Volume" : unitLabel === "kg" ? "Poids" : "Unités"} réservé
              </span>
              <span
                className={
                  isFull
                    ? "font-semibold text-destructive"
                    : occ.percent >= 80
                    ? "font-medium text-amber-600"
                    : "font-medium"
                }
              >
                {occ.used.toFixed(2)} / {occ.capacity.toFixed(2)} {unitLabel}
                {!isFull && (
                  <span className="text-muted-foreground font-normal">
                    {" "}· {occ.remaining.toFixed(2)} {unitLabel} restant{occ.remaining > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isFull
                    ? "bg-destructive"
                    : occ.percent >= 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${occ.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {s.reservationCount} réservation{s.reservationCount > 1 ? "s" : ""}
              {s.capacity ? ` · ${s.capacity}` : ""}
            </p>
          </div>
        )}
        {/* Sans plafond numérique : on affiche juste le libellé + nombre de résa */}
        {!occ && (s.capacity || s.reservationCount > 0) && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            📦 {s.capacity ?? "Capacité non plafonnée"} · {s.reservationCount} réservation{s.reservationCount > 1 ? "s" : ""}
          </p>
        )}

        {/* Notes */}
        {s.notes && (
          <p className="text-xs text-muted-foreground italic">{s.notes}</p>
        )}

        {/* CTA */}
        <div className="mt-auto pt-2">
          {closed ? (
            <Button variant="outline" size="sm" disabled className="w-full">
              Réservations fermées
            </Button>
          ) : isFull ? (
            // Départ saturé : on propose le prochain départ disponible du même
            // mode si on en a trouvé un, sinon on indique qu'aucun autre n'est
            // encore publié.
            nextSuggestion ? (
              <div className="space-y-1.5">
                <Button variant="outline" size="sm" disabled className="w-full">
                  Départ complet
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link
                    href={`/dashboard/reservations/new?scheduleId=${nextSuggestion.id}&mode=${s.mode}`}
                  >
                    Réserver sur le prochain → {formatDate(nextSuggestion.departureDate)}
                  </Link>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" disabled className="w-full">
                Complet · prochain départ à venir
              </Button>
            )
          ) : (
            <Button asChild size="sm" className="w-full">
              <Link
                href={`/dashboard/reservations/new?scheduleId=${s.id}&mode=${s.mode}`}
              >
                Réserver une place →
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
