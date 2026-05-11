import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewEnvoiForm } from "./new-envoi-form";
import type { TransportMode } from "@prisma/client";

export default async function NewEnvoiPage() {
  const schedules = await prisma.shippingSchedule.findMany({
    where: { active: true, departureDate: { gte: new Date() } },
    orderBy: { departureDate: "asc" },
    take: 20,
    select: {
      id: true,
      mode: true,
      origin: true,
      destination: true,
      departureDate: true,
      arrivalDate: true,
      capacity: true,
      notes: true,
    },
  });

  const scheduleData = schedules.map((s) => ({
    id: s.id,
    mode: s.mode as TransportMode,
    origin: s.origin,
    destination: s.destination,
    departureDate: s.departureDate.toISOString().slice(0, 10),
    arrivalDate: s.arrivalDate ? s.arrivalDate.toISOString().slice(0, 10) : "",
    capacity: s.capacity ?? "",
    notes: s.notes ?? "",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouvel envoi (voyage)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Crée un voyage groupé (départ Chine vers une destination) auquel tu pourras ensuite rattacher des colis et,
          pour le maritime, ajouter un ou plusieurs conteneurs.
        </p>
      </CardHeader>
      <CardContent>
        <NewEnvoiForm schedules={scheduleData} />
      </CardContent>
    </Card>
  );
}
