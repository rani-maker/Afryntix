import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleCards } from "./schedule-cards";

export default async function ClientSchedulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const schedules = await prisma.shippingSchedule.findMany({
    where: { active: true },
    orderBy: { departureDate: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Calendrier des expéditions</h2>
        <p className="text-sm text-muted-foreground">
          Consultez les prochains départs et réservez votre place en quelques clics.
        </p>
      </div>
      <ScheduleCards schedules={schedules} now={new Date()} />
    </div>
  );
}
