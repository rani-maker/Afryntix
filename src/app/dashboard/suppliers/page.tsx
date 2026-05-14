import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SuppliersList } from "./list";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const suppliers = await prisma.supplier.findMany({
    where: { clientId: session.user.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Mes fournisseurs Chine</CardTitle>
          <CardDescription>
            Annuaire personnel pour retrouver rapidement vos contacts, leur WeChat, leur ville et l&apos;adresse à
            communiquer à AFRYNTIX pour la collecte des marchandises.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppliersList initial={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
