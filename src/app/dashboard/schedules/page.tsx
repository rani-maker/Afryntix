import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleCards } from "./schedule-cards";
import { computeOccupancy } from "@/lib/schedule-capacity";

export default async function ClientSchedulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const raw = await prisma.shippingSchedule.findMany({
    where: { active: true },
    orderBy: { departureDate: "asc" },
    // On a besoin des dimensions réservées pour calculer l'occupation par mode.
    include: {
      reservations: {
        where: { status: { not: "REJECTED" } },
        select: { estimatedWeightKg: true, estimatedVolumeCBM: true },
      },
    },
  });

  // Pré-calcul de l'occupation côté serveur pour que les cartes restent
  // 100 % présentables (et qu'on ne traîne pas les dimensions de toutes les
  // réservations vers le navigateur).
  // On précalcule aussi, pour chaque calendrier plein, le prochain départ
  // disponible du même mode — affiché en CTA « Réserver sur le prochain ».
  const schedules = raw.map((s) => {
    const occ = computeOccupancy(s.capacityValue, s.reservations, s.mode);
    return {
      id: s.id,
      mode: s.mode,
      origin: s.origin,
      destination: s.destination,
      departureDate: s.departureDate,
      arrivalDate: s.arrivalDate,
      cutoffDate: s.cutoffDate,
      capacity: s.capacity,
      capacityValue: s.capacityValue,
      notes: s.notes,
      reservationCount: s.reservations.length,
      occupancy: occ,
    };
  });

  // Pour chaque calendrier plein, on cherche le prochain départ futur du
  // même mode avec encore de la place.
  const nextSuggestions: Record<string, { id: string; departureDate: Date } | null> = {};
  for (const s of schedules) {
    if (!s.occupancy?.isFull) continue;
    const candidate = schedules.find(
      (n) =>
        n.mode === s.mode &&
        n.departureDate > s.departureDate &&
        n.cutoffDate >= new Date() &&
        (!n.occupancy || !n.occupancy.isFull),
    );
    nextSuggestions[s.id] = candidate
      ? { id: candidate.id, departureDate: candidate.departureDate }
      : null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Calendrier des expéditions</h2>
        <p className="text-sm text-muted-foreground">
          Consultez les prochains départs et réservez votre place en quelques clics.
        </p>
      </div>
      <ScheduleCards schedules={schedules} now={new Date()} nextSuggestions={nextSuggestions} />
    </div>
  );
}
