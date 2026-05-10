import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewPaymentForm } from "./new-payment-form";

export default async function NewStaffPaymentPage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [clients, rates] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENT", active: true },
      select: { id: true, name: true, email: true, phone: true, whatsapp: true },
      orderBy: { name: "asc" },
    }),
    prisma.exchangeRate.findMany({
      where: { date: today },
      select: { fromCcy: true, toCcy: true, rate: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nouveau transfert / paiement de facture</h2>
          <p className="text-sm text-muted-foreground">
            Crée le dossier au nom du client. Pour un transfert, un code de retrait unique sera généré et envoyé par WhatsApp.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/staff/payments">← Retour</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPaymentForm clients={clients} rates={rates} />
        </CardContent>
      </Card>
    </div>
  );
}
