import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewEnvoiForm } from "./new-envoi-form";

export default function NewEnvoiPage() {
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
        <NewEnvoiForm />
      </CardContent>
    </Card>
  );
}
