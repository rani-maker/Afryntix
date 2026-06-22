import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TRANSPORT_MODE_LABELS,
  ENVOI_STATUS_LABELS,
  CARRIER_LABELS,
  CONTAINER_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/pricing";
import { formatDate, formatDateTime } from "@/lib/utils";
import { EnvoiStatusForm } from "./status-form";
import { EnvoiMetaForm } from "./meta-form";
import { ContainerSection } from "./container-section";
import { AttachShipmentsForm } from "./attach-form";
import { DetachShipmentButton } from "./detach-button";
import { DocumentsSection } from "@/components/documents/documents-section";
import { DOCUMENT_TYPES_FOR_ENVOI } from "@/lib/document-labels";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { FclInvoiceForm } from "./fcl-invoice-form";
import { DeleteEnvoiButton } from "./delete-envoi-button";

export default async function EnvoiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const envoi = await prisma.envoi.findUnique({
    where: { id },
    include: {
      containers: { orderBy: { createdAt: "asc" } },
      shipments: {
        include: {
          client: { select: { name: true } },
          container: { select: { id: true, refInternal: true, carrierNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      history: { orderBy: { createdAt: "desc" }, take: 20 },
      createdBy: { select: { name: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!envoi) notFound();

  // Facture forfaitaire éventuellement déjà liée à cet envoi (FCL uniquement)
  const fclInvoice =
    envoi.mode === "SEA_FCL"
      ? await prisma.facture.findFirst({
          where: { envoiId: envoi.id },
          select: { reference: true, totalAmount: true, amountPaid: true },
        })
      : null;

  // Colis disponibles pour rattachement (non rattachés à un autre envoi, mode compatible)
  const availableShipments = await prisma.shipment.findMany({
    where: {
      envoiId: null,
      mode: envoi.mode,
      status: { notIn: ["DELIVERED", "CANCELLED"] },
    },
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      {/* Entête */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">
                <Link href="/staff/envois" className="hover:underline">← Tous les envois</Link>
              </div>
              <CardTitle className="font-mono text-lg mt-1">{envoi.reference}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                <Badge variant="info">{ENVOI_STATUS_LABELS[envoi.status]}</Badge>
                <span className="text-muted-foreground">{TRANSPORT_MODE_LABELS[envoi.mode]}</span>
                <span className="text-muted-foreground">·</span>
                <span>{envoi.origin} → {envoi.destination}</span>
                {envoi.carrier && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span>{CARRIER_LABELS[envoi.carrier]}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Créé le {formatDateTime(envoi.createdAt)}</div>
                {envoi.createdBy && <div>Par {envoi.createdBy.name}</div>}
                {envoi.departureDate && <div>Départ : {formatDate(envoi.departureDate)}</div>}
                {envoi.arrivalDate && <div>Arrivée : {formatDate(envoi.arrivalDate)}</div>}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Manifeste interne
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/api/manifest/envoi/${envoi.id}`}>
                      <Download className="h-4 w-4" /> CSV
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/print/manifest/envoi/${envoi.id}`} target="_blank">
                      <Printer className="h-4 w-4" /> Imprimable
                    </Link>
                  </Button>
                </div>
                <div
                  className="text-xs font-semibold text-amber-700 uppercase tracking-wide text-right pt-1"
                  title="Téléphones, montants et statuts internes sont masqués"
                >
                  Pour transitaire (sans téléphones / montants)
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/api/manifest/envoi/${envoi.id}?audience=forwarder`}>
                      <Download className="h-4 w-4" /> CSV
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/print/manifest/envoi/${envoi.id}?audience=forwarder`}
                      target="_blank"
                    >
                      <Printer className="h-4 w-4" /> Imprimable
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bulk status update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mise à jour du statut</CardTitle>
          <p className="text-sm text-muted-foreground">
            Le nouveau statut sera enregistré sur l&apos;envoi. Si la case est cochée, il est répercuté
            sur les <strong>{envoi.shipments.length}</strong> colis rattachés (avec entrée d&apos;historique).
          </p>
        </CardHeader>
        <CardContent>
          <EnvoiStatusForm
            envoiId={envoi.id}
            currentStatus={envoi.status}
            shipmentCount={envoi.shipments.length}
          />
        </CardContent>
      </Card>

      {/* Métadonnées éditables (carrier, MAWB, vessel…) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identification carrier</CardTitle>
          <p className="text-sm text-muted-foreground">
            Booking, navire / vol, MAWB. Ces informations sont saisies pour l&apos;organisation et,
            à terme, pour l&apos;intégration API du carrier.
          </p>
        </CardHeader>
        <CardContent>
          <EnvoiMetaForm
            envoiId={envoi.id}
            mode={envoi.mode}
            initial={{
              carrier: envoi.carrier,
              bookingNumber: envoi.bookingNumber,
              vesselName: envoi.vesselName,
              voyageNumber: envoi.voyageNumber,
              mawb: envoi.mawb,
              flightNumber: envoi.flightNumber,
              departureDate: envoi.departureDate ? envoi.departureDate.toISOString().slice(0, 10) : "",
              arrivalDate: envoi.arrivalDate ? envoi.arrivalDate.toISOString().slice(0, 10) : "",
              notes: envoi.notes,
            }}
          />
        </CardContent>
      </Card>

      {/* Conteneurs (uniquement maritime) */}
      {(envoi.mode === "SEA_LCL" || envoi.mode === "SEA_FCL") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conteneurs ({envoi.containers.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Crée un conteneur avec une référence interne (avant chargement), puis renseigne le numéro carrier
              une fois le container chargé.
            </p>
          </CardHeader>
          <CardContent>
            <ContainerSection envoiId={envoi.id} containers={envoi.containers} />
          </CardContent>
        </Card>
      )}

      {/* Colis rattachés */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colis rattachés ({envoi.shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Conteneur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envoi.shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucun colis rattaché.
                  </TableCell>
                </TableRow>
              ) : (
                envoi.shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/staff/shipments/${s.id}`} className="hover:text-primary">
                        {s.trackingNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.client?.name ?? s.clientName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.container ? (
                        <span className="font-mono">{s.container.refInternal}{s.container.carrierNumber ? ` · ${s.container.carrierNumber}` : ""}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{SHIPMENT_STATUS_LABELS[s.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[s.destinationCity, s.destinationCountry].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DetachShipmentButton shipmentId={s.id} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rattacher des colis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rattacher des colis ({availableShipments.length} disponibles)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Colis du même mode ({TRANSPORT_MODE_LABELS[envoi.mode]}), non rattachés à un autre envoi, et pas encore livrés.
          </p>
        </CardHeader>
        <CardContent>
          <AttachShipmentsForm
            envoiId={envoi.id}
            containers={envoi.containers.map((c) => ({ id: c.id, refInternal: c.refInternal, carrierNumber: c.carrierNumber }))}
            shipments={availableShipments.map((s) => ({
              id: s.id,
              trackingNumber: s.trackingNumber,
              clientLabel: s.client?.name ?? s.clientName ?? "—",
              destination: [s.destinationCity, s.destinationCountry].filter(Boolean).join(", "),
            }))}
          />
        </CardContent>
      </Card>

      {/* Facturation forfaitaire FCL */}
      {envoi.mode === "SEA_FCL" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facturation forfaitaire (conteneur complet)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Le client paie un prix forfaitaire négocié pour l&apos;ensemble du conteneur — pas par colis.
              Le forfait sera réparti entre les colis rattachés (au CBM si possible, sinon à parts égales)
              et une seule facture sera générée pour l&apos;envoi.
            </p>
          </CardHeader>
          <CardContent>
            <FclInvoiceForm
              envoiId={envoi.id}
              shipmentCount={envoi.shipments.length}
              existingFlatRate={fclInvoice?.totalAmount ?? null}
              existingReference={fclInvoice?.reference ?? null}
              existingPaid={fclInvoice?.amountPaid ?? 0}
            />
          </CardContent>
        </Card>
      )}

      {/* Documents logistiques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents logistiques</CardTitle>
          <p className="text-sm text-muted-foreground">
            MAWB, B/L, manifeste container, déclaration douanière groupée, certificat d&apos;assurance…
          </p>
        </CardHeader>
        <CardContent>
          <DocumentsSection
            documents={envoi.documents}
            allowedTypes={DOCUMENT_TYPES_FOR_ENVOI}
            target={{ envoiId: envoi.id }}
          />
        </CardContent>
      </Card>

      {/* Zone dangereuse — suppression */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-900">Zone sensible</CardTitle>
          <p className="text-sm text-muted-foreground">
            Supprime cet envoi en cas d&apos;erreur de création. Les colis rattachés sont conservés
            (juste détachés), mais l&apos;envoi, ses conteneurs, son historique et ses documents
            sont effacés définitivement.
          </p>
        </CardHeader>
        <CardContent>
          <DeleteEnvoiButton
            envoiId={envoi.id}
            reference={envoi.reference}
            shipmentCount={envoi.shipments.length}
          />
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des statuts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envoi.history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Aucun historique.
                  </TableCell>
                </TableRow>
              ) : (
                envoi.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</TableCell>
                    <TableCell><Badge variant="secondary">{ENVOI_STATUS_LABELS[h.status]}</Badge></TableCell>
                    <TableCell className="text-sm">{h.note ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
