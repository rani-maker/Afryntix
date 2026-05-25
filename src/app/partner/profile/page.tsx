import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ChangePasswordForm } from "./change-password-form";

const TYPE_LABELS: Record<string, string> = {
  APPORTEUR: "Apporteur d'affaires",
  REVENDEUR: "Revendeur",
  TRANSPORTEUR_RELAIS: "Transporteur relais",
  AGENT_CHINE: "Agent Chine",
  CONFRERE_FORWARDER: "Confrère forwarder",
};

const COMMISSION_LABELS: Record<string, string> = {
  PERCENT_OF_REVENUE: "% sur CA encaissé",
  PERCENT_OF_MARGIN: "% sur marge brute",
  FIXED_PER_SHIPMENT: "Forfait / colis",
  FIXED_PER_KG: "Forfait / kg",
  FIXED_PER_CBM: "Forfait / CBM",
  WHOLESALE_TARIFF: "Tarif gros",
};

export default async function PartnerProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) redirect("/partner");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations partenaire</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Code partenaire</dt>
              <dd className="font-mono">{partner.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Code parrain</dt>
              <dd className="font-mono font-bold">{partner.referralCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd><Badge variant="info">{TYPE_LABELS[partner.type]}</Badge></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut</dt>
              <dd><Badge variant={partner.status === "ACTIVE" ? "success" : "warning"}>{partner.status}</Badge></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Société</dt>
              <dd>{partner.companyName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Forme juridique</dt>
              <dd>{partner.legalForm ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Contact</dt>
              <dd>{partner.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Téléphone</dt>
              <dd>{partner.contactPhone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">WhatsApp</dt>
              <dd>{partner.whatsapp ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd>{partner.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ville</dt>
              <dd>{partner.city}, {partner.country}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Zones desservies</dt>
              <dd>{partner.serviceAreas.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Modèle de rémunération</dt>
              <dd>{COMMISSION_LABELS[partner.commissionModel]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Taux / Montant</dt>
              <dd>{partner.commissionRate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Membre depuis</dt>
              <dd>{formatDateTime(partner.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Contrat signé le</dt>
              <dd>{partner.contractSignedAt ? formatDateTime(partner.contractSignedAt) : "Non signé"}</dd>
            </div>
          </dl>
          {partner.contractUrl && (
            <div className="mt-6">
              <a href={partner.contractUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                📄 Télécharger le contrat
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sécurité du compte</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comment recevoir des commissions ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Communiquez votre code parrain <strong className="text-foreground font-mono">{partner.referralCode}</strong> à vos clients.</p>
          <p>2. À leur inscription, ils saisissent ce code dans le formulaire.</p>
          <p>3. Chaque colis qu'ils expédient via AFRYNTIX vous est automatiquement rattaché.</p>
          <p>4. Dès que le client paie intégralement son colis, votre commission est créditée.</p>
          <p>5. Vous recevez une notification WhatsApp à chaque commission gagnée et à chaque versement effectué.</p>
        </CardContent>
      </Card>
    </div>
  );
}
