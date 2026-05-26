import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForwarderNewForm } from "./forwarder-new-form";

export default async function NewForwarderShipmentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true, commissionModel: true, commissionRate: true, companyName: true },
  });
  if (!partner) redirect("/partner");
  if (partner.type !== "CONFRERE_FORWARDER") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Réservé aux confrères forwarders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Vous n'avez pas accès à cette page.</p>
        </CardContent>
      </Card>
    );
  }
  if (partner.status !== "ACTIVE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compte non actif</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Votre compte partenaire doit être actif. Contactez AFRYNTIX.
          </p>
        </CardContent>
      </Card>
    );
  }

  const discount =
    partner.commissionModel === "WHOLESALE_TARIFF" && partner.commissionRate
      ? partner.commissionRate
      : 0;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <Link href="/partner/wholesale" className="text-xs text-muted-foreground hover:underline">
          ← Mes envois gros
        </Link>
        <h1 className="text-xl font-semibold mt-1">Nouveau colis au tarif gros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tarif négocié : <Badge variant="info">{discount}% de remise</Badge> sur le prix public AFRYNTIX
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ForwarderNewForm discountPercent={discount} />
        </CardContent>
      </Card>
    </div>
  );
}
