import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceRequestForm } from "./service-request-form";

export default async function ClientServicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Demander un service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Notre équipe propose en complément du transport :
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li><strong>Contrôle qualité</strong> — vérification de votre commande chez le fournisseur</li>
            <li><strong>Achat / Sourcing</strong> — nous achetons pour vous en Chine</li>
            <li><strong>Achat véhicule / engin BTP</strong></li>
            <li><strong>Paiement de facture</strong> — paiement de vos fournisseurs en Chine</li>
            <li><strong>Négoce</strong> — fournisseurs, transitaires, opérations commerciales</li>
          </ul>
          <ServiceRequestForm
            defaultName={session.user.name}
            defaultEmail={session.user.email}
            defaultPhone={session.user.phone ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
