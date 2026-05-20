import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShipmentStatusBadge } from "@/components/dashboard/status-badge";
import { TRANSPORT_MODE_LABELS } from "@/lib/pricing";
import { formatXOF, formatDate } from "@/lib/utils";
import { SendReceptionNoticeButton } from "./send-notice-button";
import { EditShippingMarkButton } from "./edit-mark-button";

export default async function ShippingMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const marks = await prisma.shippingMark.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      shipments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          trackingNumber: true,
          mode: true,
          status: true,
          description: true,
          totalAmount: true,
          depositAmount: true,
          amountPaid: true,
          createdAt: true,
          registrationNotifiedAt: true,
          envoiId: true,
          envoi: { select: { reference: true, status: true } },
          facture: { select: { reference: true, status: true, remainingAmount: true } },
        },
      },
    },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Shipping Marks ({marks.length})</CardTitle>
          <form className="flex gap-2 max-w-xl" action="/staff/shipping-marks">
            <Input
              name="q"
              defaultValue={search}
              placeholder="Recherche par nom, téléphone…"
            />
            <Button type="submit" variant="outline">Rechercher</Button>
            {search && (
              <Button asChild variant="ghost">
                <Link href="/staff/shipping-marks">Effacer</Link>
              </Button>
            )}
          </form>
        </CardHeader>
      </Card>

      {marks.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Aucun shipping mark trouvé.
        </div>
      )}

      {marks.map((mark) => {
        const pending = mark.shipments.filter((s) => !s.registrationNotifiedAt);
        const totalPendingDeposit = pending.reduce((sum, s) => sum + s.depositAmount, 0);
        const activeShipments = mark.shipments.filter(
          (s) => s.status !== "DELIVERED" && s.status !== "CANCELLED",
        );

        return (
          <Card key={mark.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-semibold text-lg">{mark.name}</div>
                  <div className="text-sm text-muted-foreground">{mark.phone}</div>
                  {mark.user && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Compte : {mark.user.name} — {mark.user.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-right text-sm">
                    <div className="font-medium">{activeShipments.length} colis actif{activeShipments.length > 1 ? "s" : ""}</div>
                    {pending.length > 0 && (
                      <div className="text-amber-600 text-xs font-medium">
                        {pending.length} en attente de notification
                      </div>
                    )}
                  </div>
                  {pending.length > 0 && (
                    <SendReceptionNoticeButton
                      shippingMarkId={mark.id}
                      count={pending.length}
                      totalDeposit={totalPendingDeposit}
                    />
                  )}
                  <EditShippingMarkButton
                    mark={{
                      id: mark.id,
                      name: mark.name,
                      phone: mark.phone,
                      whatsapp: mark.whatsapp,
                      notes: mark.notes,
                    }}
                  />
                </div>
              </div>
            </CardHeader>

            {mark.shipments.length > 0 && (
              <CardContent className="pt-0">
                <div className="rounded-md border divide-y text-sm">
                  {mark.shipments.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                      {/* Indicateur notification */}
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          s.registrationNotifiedAt ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                        title={
                          s.registrationNotifiedAt
                            ? `Notifié le ${formatDate(s.registrationNotifiedAt)}`
                            : "Pas encore notifié"
                        }
                      />

                      {/* Tracking */}
                      <Link
                        href={`/tracking/${s.trackingNumber}`}
                        className="font-mono text-primary hover:underline text-xs shrink-0"
                      >
                        {s.trackingNumber}
                      </Link>

                      {/* Mode + description */}
                      <span className="text-xs text-muted-foreground truncate">
                        {TRANSPORT_MODE_LABELS[s.mode]}
                        {s.description ? ` — ${s.description}` : ""}
                      </span>

                      {/* Statut */}
                      <ShipmentStatusBadge status={s.status} />

                      {/* Envoi */}
                      {s.envoi && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {s.envoi.reference}
                        </span>
                      )}

                      {/* Facture */}
                      {s.facture && (
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {s.facture.reference}
                          {s.facture.status !== "FULLY_PAID" && (
                            <span className="text-destructive ml-1">
                              ({formatXOF(s.facture.remainingAmount)})
                            </span>
                          )}
                        </span>
                      )}

                      {/* Date + lien gérer */}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {formatDate(s.createdAt)}
                      </span>
                      <Link
                        href={`/staff/shipments/${s.id}`}
                        className="text-xs text-muted-foreground hover:text-primary shrink-0"
                      >
                        Gérer
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Légende */}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Non notifié
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Notifié
                  </span>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
