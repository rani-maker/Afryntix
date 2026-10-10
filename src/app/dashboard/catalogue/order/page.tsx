import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CatalogOrderForm } from "./order-form";

export default async function NewCatalogOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { catalog } = await searchParams;
  const [catalogs, user] = await Promise.all([
    prisma.catalog.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, category: true, title: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true, whatsapp: true, city: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle commande</CardTitle>
          <CardDescription>
            Sélectionnez vos articles : pour chacun, indiquez le catalogue, la référence et la quantité. Validez votre
            bon de commande, AFRYNTIX vous envoie ensuite un devis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {catalogs.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Aucun catalogue n&apos;est disponible pour le moment.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/catalogue">Retour aux catalogues</Link>
              </Button>
            </div>
          ) : (
            <CatalogOrderForm
              catalogs={catalogs}
              defaultCatalogId={catalogs.some((c) => c.id === catalog) ? catalog! : catalogs[0].id}
              defaultPhone={user?.whatsapp ?? user?.phone ?? ""}
              defaultCity={user?.city ?? ""}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
