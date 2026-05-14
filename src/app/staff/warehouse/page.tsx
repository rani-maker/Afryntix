import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WarehouseLookup } from "./lookup";

export default function WarehouseModePage() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Mode entrepôt</CardTitle>
          <CardDescription>
            Outil mobile pour la réception en entrepôt Chine : recherche rapide d&apos;un colis et pesée vérifiée
            (recalcul automatique du prix).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseLookup />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        💡 Ajoute cette page à l&apos;écran d&apos;accueil de ton téléphone pour un accès rapide hors connexion partielle.
      </p>
    </div>
  );
}
