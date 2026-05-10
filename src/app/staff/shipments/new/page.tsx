import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NewShipmentForm } from "./new-shipment-form";
import type { TransportMode, CargoCategory } from "@prisma/client";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });

  const initial = {
    reservationId: pick("reservationId"),
    clientId: pick("clientId"),
    mode: pick("mode") as TransportMode | undefined,
    category: pick("category") as CargoCategory | undefined,
    weightKg: pick("weightKg"),
    volumeCBM: pick("volumeCBM"),
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Enregistrer une nouvelle expédition</CardTitle>
        <CardDescription>
          Le client recevra automatiquement son numéro de suivi et le détail de tarification par WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewShipmentForm clients={clients} initial={initial} />
      </CardContent>
    </Card>
  );
}
