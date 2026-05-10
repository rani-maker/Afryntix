import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewReservationForm } from "./new-reservation-form";
import type { TransportMode } from "@prisma/client";

const VALID_MODES: TransportMode[] = [
  "AIR_EXPRESS",
  "AIR_NORMAL",
  "SEA_LCL",
  "SEA_FCL",
  "VEHICLE",
  "BTP_EQUIPMENT",
  "STORAGE",
];

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ scheduleId?: string; mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { scheduleId: defaultScheduleId, mode: rawMode } = await searchParams;
  const defaultMode = VALID_MODES.includes(rawMode as TransportMode)
    ? (rawMode as TransportMode)
    : undefined;

  const schedules = await prisma.shippingSchedule.findMany({
    where: { active: true, cutoffDate: { gte: new Date() } },
    orderBy: { departureDate: "asc" },
  });

  const backHref =
    defaultScheduleId ? "/dashboard/schedules" : "/dashboard/reservations";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nouvelle réservation</h2>
          <p className="text-sm text-muted-foreground">
            Indiquez le n° de suivi de votre fournisseur en Chine et joignez la photo du colis.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>← Retour</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détails de la réservation</CardTitle>
        </CardHeader>
        <CardContent>
          <NewReservationForm
            schedules={schedules}
            defaultScheduleId={defaultScheduleId}
            defaultMode={defaultMode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
