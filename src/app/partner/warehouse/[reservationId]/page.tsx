import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiveForm } from "./receive-form";

const MODE_LABELS: Record<string, string> = {
  AIR_EXPRESS: "Aérien Express",
  AIR_NORMAL: "Aérien Normal",
  SEA_LCL: "Maritime LCL",
  SEA_FCL: "Maritime FCL",
  VEHICLE: "Véhicule",
  BTP_EQUIPMENT: "BTP",
  STORAGE: "Entreposage",
};

const CATEGORY_LABELS: Record<string, string> = {
  ORDINARY: "Ordinaire",
  BATTERY: "Batterie",
  LIQUID: "Liquide",
  COSMETIC: "Cosmétique",
  POWDER: "Poudre",
  PHONE: "Téléphone",
  COMPUTER: "Ordinateur",
  VEHICLE: "Véhicule",
  BTP: "Engin BTP",
  OTHER: "Autre",
};

export default async function ReceiveReservationPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { id: true, type: true, status: true },
  });
  if (!partner || partner.type !== "AGENT_CHINE") redirect("/partner");

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { client: true, schedule: true },
  });
  if (!reservation) notFound();

  if (reservation.status !== "VALIDATED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Réservation non disponible</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette réservation est en statut <Badge variant="secondary">{reservation.status}</Badge>. Seules les réservations validées peuvent être réceptionnées.
          </p>
          <Link href="/partner/warehouse" className="text-sm text-primary hover:underline">← Retour à la file</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <Link href="/partner/warehouse" className="text-xs text-muted-foreground hover:underline">
          ← File de réception
        </Link>
        <h1 className="text-xl font-semibold mt-1">Réception du colis</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Détails annoncés par le client</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Client</dt>
              <dd className="font-medium">{reservation.client.name}</dd>
              <dd className="text-xs text-muted-foreground">{reservation.client.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">N° tracking fournisseur</dt>
              <dd className="font-mono">{reservation.supplierTrackingNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mode</dt>
              <dd><Badge variant="info">{MODE_LABELS[reservation.mode]}</Badge></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Catégorie</dt>
              <dd>{CATEGORY_LABELS[reservation.category]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Poids déclaré</dt>
              <dd>{reservation.estimatedWeightKg != null ? `${reservation.estimatedWeightKg} kg` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Volume déclaré</dt>
              <dd>{reservation.estimatedVolumeCBM != null ? `${reservation.estimatedVolumeCBM} CBM` : "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd>{reservation.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Destinataire</dt>
              <dd>{reservation.recipientName ?? "—"}</dd>
              <dd className="text-xs text-muted-foreground">{reservation.recipientPhone ?? ""}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Adresse</dt>
              <dd>{reservation.recipientAddress ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesée et mesures réelles</CardTitle>
          <p className="text-xs text-muted-foreground">
            Les valeurs que vous saisissez ici font foi pour la facturation. Photographiez le colis et l'étiquette fournisseur.
          </p>
        </CardHeader>
        <CardContent>
          <ReceiveForm
            reservationId={reservation.id}
            defaultPieces={1}
            declaredWeight={reservation.estimatedWeightKg}
            declaredVolume={reservation.estimatedVolumeCBM}
            mode={reservation.mode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
