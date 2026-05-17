import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShipmentStatusBadge, PaymentStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatDateTime, formatXOF } from "@/lib/utils";
import {
  StatusUpdateForm,
  RecordPaymentForm,
  VerifyWeightForm,
  ChargeStorageFeesButton,
  PickupAndDeliveryForms,
  InsuranceForm,
  CustomsInfoForm,
  EditShipmentInfoForm,
} from "./forms";
import { getActiveInsuranceSetting } from "@/server/actions/insurance";
import { computeStorageFee } from "@/lib/storage-fees";
import { getActiveStorageSetting } from "@/server/actions/storage";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { DocumentsSection } from "@/components/documents/documents-section";
import { DOCUMENT_TYPES_FOR_SHIPMENT } from "@/lib/document-labels";
import { ClaimsSection } from "@/components/claims/claims-section";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      client: true,
      history: { orderBy: { createdAt: "desc" } },
      envoi: { select: { id: true, reference: true } },
      container: { select: { refInternal: true, carrierNumber: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      claims: {
        orderBy: { createdAt: "desc" },
        include: {
          openedBy: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!shipment) notFound();

  const storageSetting = await getActiveStorageSetting();
  const insuranceSetting = await getActiveInsuranceSetting();
  const storageQuote = computeStorageFee({
    availableSinceAt: shipment.availableSinceAt,
    freeDays: storageSetting.freeDays,
    dailyRateXOF: storageSetting.dailyRateXOF,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/staff/shipments" className="text-xs text-muted-foreground hover:text-primary">
            ← Retour aux expéditions
          </Link>
          <h2 className="text-2xl font-bold font-mono mt-1">{shipment.trackingNumber}</h2>
        </div>
        <div className="flex items-center gap-2">
          <ShipmentStatusBadge status={shipment.status} />
          <PaymentStatusBadge status={shipment.paymentStatus} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/print/shipment-label/${shipment.id}`} target="_blank">
              <Printer className="h-4 w-4" /> Étiquette
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails du colis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Client"
              value={
                shipment.client
                  ? `${shipment.client.name} (${shipment.client.email})`
                  : `${shipment.clientName ?? "—"}${shipment.clientPhone ? ` (${shipment.clientPhone})` : ""} · sans compte`
              }
            />
            <Row label="Mode" value={TRANSPORT_MODE_LABELS[shipment.mode]} />
            <Row label="Catégorie" value={CARGO_CATEGORY_LABELS[shipment.category]} />
            <Row label="Pièces" value={String(shipment.pieces)} />
            {shipment.declaredWeightKg != null && (
              <Row label="Poids déclaré" value={`${shipment.declaredWeightKg} kg`} />
            )}
            {shipment.verifiedWeightKg != null && (
              <Row
                label="Poids vérifié"
                value={`${shipment.verifiedWeightKg} kg${
                  shipment.declaredWeightKg != null
                    ? ` (écart ${(shipment.verifiedWeightKg - shipment.declaredWeightKg).toFixed(2)} kg)`
                    : ""
                }`}
              />
            )}
            {shipment.verifiedWeightKg == null && shipment.weightKg != null && (
              <Row label="Poids effectif" value={`${shipment.weightKg} kg`} />
            )}
            {shipment.volumetricWeight != null && (
              <Row label="Poids volumique" value={`${shipment.volumetricWeight.toFixed(2)} kg`} />
            )}
            {shipment.volumeCBM != null && <Row label="Volume" value={`${shipment.volumeCBM.toFixed(3)} m³`} />}
            {shipment.destinationCity && <Row label="Destination" value={`${shipment.destinationCity}, ${shipment.destinationCountry ?? ""}`} />}
            {shipment.recipientName && <Row label="Receveur" value={shipment.recipientName} />}
            {shipment.recipientPhone && <Row label="Téléphone" value={shipment.recipientPhone} />}
            {shipment.envoi && (
              <div className="flex items-baseline gap-2 py-1 border-t pt-3 mt-3">
                <span className="text-xs uppercase text-muted-foreground w-32 shrink-0">Envoi</span>
                <Link href={`/staff/envois/${shipment.envoi.id}`} className="text-sm font-mono text-primary hover:underline">
                  {shipment.envoi.reference}
                </Link>
              </div>
            )}
            {shipment.container && (
              <Row
                label="Conteneur"
                value={`${shipment.container.refInternal}${shipment.container.carrierNumber ? ` · ${shipment.container.carrierNumber}` : ""}`}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarification & Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Prix unitaire" value={shipment.unitPrice ? formatXOF(shipment.unitPrice) : "—"} />
            <Row label="Total" value={formatXOF(shipment.totalAmount)} />
            <Row label="Acompte 50%" value={formatXOF(shipment.depositAmount)} />
            <Row label="Solde 50%" value={formatXOF(shipment.remainingAmount)} />
            <Row label="Déjà encaissé" value={formatXOF(shipment.amountPaid)} />
            <div className="pt-3">
              <RecordPaymentForm shipmentId={shipment.id} maxAmount={shipment.totalAmount - shipment.amountPaid} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modifier les informations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Corriger une erreur de saisie. Le poids / dimensions / mode ne peuvent être modifiés que tant qu&apos;aucun
            paiement n&apos;a été enregistré et que le colis n&apos;est pas en route. Toute modification est tracée dans
            l&apos;historique.
          </p>
        </CardHeader>
        <CardContent>
          <EditShipmentInfoForm
            shipmentId={shipment.id}
            amountPaid={shipment.amountPaid}
            status={shipment.status}
            hasEnvoiOrContainer={!!shipment.envoiId || !!shipment.containerId}
            initial={{
              mode: shipment.mode,
              category: shipment.category,
              description: shipment.description,
              pieces: shipment.pieces,
              weightKg: shipment.declaredWeightKg ?? shipment.weightKg,
              lengthCm: shipment.lengthCm,
              widthCm: shipment.widthCm,
              heightCm: shipment.heightCm,
              volumeCBM: shipment.volumeCBM,
              destinationCity: shipment.destinationCity,
              destinationCountry: shipment.destinationCountry,
              recipientName: shipment.recipientName,
              recipientPhone: shipment.recipientPhone,
              recipientAddress: shipment.recipientAddress,
            }}
          />
        </CardContent>
      </Card>

      {shipment.status === "DELIVERED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Livraison effectuée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {shipment.deliveredAt && <Row label="Date" value={formatDateTime(shipment.deliveredAt)} />}
            {shipment.deliveredToName && <Row label="Remis à" value={shipment.deliveredToName} />}
            {shipment.deliveredToPhone && <Row label="Téléphone" value={shipment.deliveredToPhone} />}
            {shipment.deliveredToIdNumber && <Row label="Pièce d'identité" value={shipment.deliveredToIdNumber} />}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Code de retrait & Preuve de livraison</CardTitle>
            <p className="text-sm text-muted-foreground">
              Génère un code OTP à 6 chiffres envoyé au client par WhatsApp. À la remise, le staff saisit le code +
              l&apos;identité du présent pour clôturer le colis.
            </p>
          </CardHeader>
          <CardContent>
            <PickupAndDeliveryForms
              shipmentId={shipment.id}
              hasCode={!!shipment.pickupCode}
              codeIssuedAt={shipment.pickupCodeIssuedAt ?? null}
              status={shipment.status}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conformité douanière</CardTitle>
          <p className="text-sm text-muted-foreground">
            Code SH (HS code), Incoterm, pays d&apos;origine, valeur en douane. Indispensable pour le dédouanement
            destination.
          </p>
        </CardHeader>
        <CardContent>
          <CustomsInfoForm
            shipmentId={shipment.id}
            initial={{
              hsCode: shipment.hsCode,
              incoterm: shipment.incoterm,
              countryOfOrigin: shipment.countryOfOrigin,
              declaredCustomsValue: shipment.declaredCustomsValue,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assurance cargo</CardTitle>
        </CardHeader>
        <CardContent>
          <InsuranceForm
            shipmentId={shipment.id}
            optedIn={shipment.insuranceOptedIn}
            declaredValue={shipment.declaredValue}
            premium={shipment.insurancePremium}
            coverage={shipment.insuranceMaxCoverage}
            ratePercent={insuranceSetting.ratePercent}
            minPremium={insuranceSetting.minPremiumXOF}
            maxCoverage={insuranceSetting.maxCoverageXOF}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesée vérifiée (entrepôt Chine)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Le poids vérifié écrase le poids déclaré et déclenche le recalcul automatique du prix (réel et volumique).
          </p>
        </CardHeader>
        <CardContent>
          <VerifyWeightForm
            shipmentId={shipment.id}
            declaredWeightKg={shipment.declaredWeightKg ?? null}
            currentVerified={shipment.verifiedWeightKg ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mettre à jour le statut</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusUpdateForm shipmentId={shipment.id} currentStatus={shipment.status} />
        </CardContent>
      </Card>

      {shipment.availableSinceAt && (
        <Card>
          <CardHeader>
            <CardTitle>Entreposage</CardTitle>
            <p className="text-sm text-muted-foreground">
              Disponible depuis le {formatDate(shipment.availableSinceAt)} · free-time {storageSetting.freeDays} jours ·
              {" "}{storageSetting.dailyRateXOF.toLocaleString("fr-FR")} FCFA / jour au-delà.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-3 text-sm mb-4">
              <div>
                <div className="text-xs text-muted-foreground">Jours depuis mise à dispo.</div>
                <div className="font-semibold">{storageQuote.daysSinceAvailable}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Jours facturables</div>
                <div className="font-semibold">{storageQuote.billableDays}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Frais en cours</div>
                <div className="font-semibold">{storageQuote.amount.toLocaleString("fr-FR")} FCFA</div>
              </div>
            </div>
            <ChargeStorageFeesButton
              shipmentId={shipment.id}
              alreadyCharged={shipment.storageChargedAt != null}
              pendingDays={storageQuote.billableDays}
              pendingAmount={storageQuote.amount}
              chargedAmount={shipment.storageFeeAmount}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents logistiques</CardTitle>
          <p className="text-sm text-muted-foreground">
            AWB / B/L, packing list, facture commerciale, certificat d&apos;origine, déclaration douanière, POD…
          </p>
        </CardHeader>
        <CardContent>
          <DocumentsSection
            documents={shipment.documents}
            allowedTypes={DOCUMENT_TYPES_FOR_SHIPMENT}
            target={{ shipmentId: shipment.id }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réclamations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Perte, casse, retard, manquant. Joignez les photos dans la section Documents.
          </p>
        </CardHeader>
        <CardContent>
          <ClaimsSection
            shipmentId={shipment.id}
            claims={shipment.claims}
            isStaff
            canCreate
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {shipment.history.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/20 pl-4 py-1">
                <div className="text-sm">
                  <ShipmentStatusBadge status={h.status} />
                  <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
                {(h.location || h.note) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {h.location && <span>📍 {h.location} </span>}
                    {h.note && <span>— {h.note}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
