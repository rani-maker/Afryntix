import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getActiveInsuranceSetting } from "@/server/actions/insurance";
import { InsuranceSettingForm } from "./form";

export default async function AdminInsurancePage() {
  const setting = await getActiveInsuranceSetting();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres d&apos;assurance cargo</CardTitle>
          <CardDescription>
            La prime est calculée comme max(prime plancher, valeur déclarée × taux %). L&apos;indemnisation est plafonnée
            à la couverture maximale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InsuranceSettingForm
            initial={{
              ratePercent: setting.ratePercent,
              minPremiumXOF: setting.minPremiumXOF,
              maxCoverageXOF: setting.maxCoverageXOF,
              notes: setting.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
