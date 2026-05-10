import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";

export default async function ClientShipmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const shipments = await prisma.shipment.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes expéditions ({shipments.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ShipmentsTable rows={shipments} />
      </CardContent>
    </Card>
  );
}
