import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatXOF } from "@/lib/utils";
import { PrintButton } from "./print-button";

const TYPE_LABELS: Record<string, string> = {
  APPORTEUR: "Apporteur d'affaires",
  REVENDEUR: "Revendeur (sous-agent)",
  TRANSPORTEUR_RELAIS: "Transporteur relais last-mile",
  AGENT_CHINE: "Agent Chine (sourcing / QC / entrepôt)",
  CONFRERE_FORWARDER: "Confrère transitaire",
};

function commissionDescription(model: string, rate: number | null, currency: string): string {
  if (rate == null) return "Selon accord ultérieur entre les parties.";
  switch (model) {
    case "PERCENT_OF_REVENUE":
      return `${rate}% du chiffre d'affaires encaissé sur chaque colis apporté par le Partenaire, calculé sur le montant total facturé (HT) au client final, et versé après encaissement complet de la facture.`;
    case "PERCENT_OF_MARGIN":
      return `${rate}% de la marge brute réalisée sur chaque colis apporté par le Partenaire, versé après encaissement complet de la facture.`;
    case "FIXED_PER_SHIPMENT":
      return `${formatXOF(rate)} par colis traité, versé après encaissement complet.`;
    case "FIXED_PER_KG":
      return `${formatXOF(rate)} par kilogramme facturable, versé après encaissement complet.`;
    case "FIXED_PER_CBM":
      return `${formatXOF(rate)} par mètre cube (CBM), versé après encaissement complet.`;
    case "WHOLESALE_TARIFF":
      return `Tarif de gros négocié au cas par cas — aucune commission automatique. Le Partenaire facture lui-même son client final.`;
    default:
      return "Selon accord ultérieur.";
  }
}

export default async function PartnerContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) notFound();

  const today = new Date();

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Bandeau d'action (non imprimé) */}
      <div className="print:hidden bg-slate-100 border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-700">
          <strong>Contrat pré-rempli</strong> — vérifiez les informations puis imprimez (Ctrl/Cmd + P) ou sauvegardez en PDF.
        </div>
        <PrintButton />
      </div>

      {/* Document imprimable */}
      <article className="max-w-[820px] mx-auto px-12 py-12 text-[13px] leading-relaxed">
        {/* En-tête */}
        <header className="text-center border-b-2 border-black pb-6 mb-8">
          <h1 className="text-2xl font-bold tracking-wide">AFRYNTIX SARL</h1>
          <p className="text-xs mt-1">
            Transport &amp; logistique Chine — Afrique de l'Ouest
            <br />
            Angré Château — Abidjan, Côte d'Ivoire — +225 07 06 26 04 05
          </p>
        </header>

        <h2 className="text-xl font-bold text-center uppercase mb-8">
          Contrat de partenariat commercial
        </h2>

        {/* Parties */}
        <section className="mb-6">
          <p className="font-semibold mb-2">ENTRE LES SOUSSIGNÉS :</p>
          <p>
            <strong>AFRYNTIX SARL</strong>, société à responsabilité limitée, dont le siège social est situé à
            Abidjan (Côte d'Ivoire), ci-après dénommée « <strong>AFRYNTIX</strong> »,
          </p>
          <p className="mt-3 font-semibold">D'UNE PART,</p>
          <p className="mt-4">ET :</p>
          <p className="mt-2">
            <strong>{partner.companyName}</strong>
            {partner.legalForm ? ` (${partner.legalForm})` : ""}, représenté(e) par{" "}
            <strong>{partner.contactName}</strong>, dont les coordonnées sont :
          </p>
          <ul className="list-none mt-2 ml-6 space-y-1">
            <li>· Téléphone : {partner.contactPhone}</li>
            {partner.whatsapp && partner.whatsapp !== partner.contactPhone && (
              <li>· WhatsApp : {partner.whatsapp}</li>
            )}
            {partner.email && <li>· Email : {partner.email}</li>}
            <li>· Adresse : {partner.city}, {partner.country}</li>
            {partner.taxId && <li>· N° RCCM / Identifiant fiscal : {partner.taxId}</li>}
            <li>
              · N° de pièce d'identité du représentant :{" "}
              {partner.idDocumentNumber ? partner.idDocumentNumber : (
                <span className="border-b border-black inline-block min-w-[200px]">&nbsp;</span>
              )}
            </li>
          </ul>
          <p className="mt-3">
            ci-après dénommé(e) le « <strong>Partenaire</strong> »,
          </p>
          <p className="mt-3 font-semibold">D'AUTRE PART,</p>
        </section>

        {/* Préambule */}
        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 1 — Objet</h3>
          <p>
            Le présent contrat a pour objet de définir les conditions de la collaboration entre AFRYNTIX et le
            Partenaire dans le cadre de prestations de logistique entre la Chine et l'Afrique de l'Ouest.
          </p>
          <p className="mt-2">
            Le Partenaire intervient en qualité de :{" "}
            <strong>{TYPE_LABELS[partner.type] ?? partner.type}</strong>.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 2 — Zone d'intervention</h3>
          <p>
            Le Partenaire opère principalement à <strong>{partner.city}</strong> ({partner.country})
            {partner.serviceAreas.length > 0 && (
              <> et couvre les zones suivantes : <strong>{partner.serviceAreas.join(", ")}</strong></>
            )}
            .
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 3 — Code parrain</h3>
          <p>
            AFRYNTIX attribue au Partenaire le code parrain unique suivant, à communiquer à ses clients :
          </p>
          <p className="text-center my-3 text-lg font-mono font-bold border-2 border-black inline-block px-4 py-2 mx-auto block w-fit">
            {partner.referralCode}
          </p>
          <p>
            Tout client utilisant ce code parrain lors de son inscription ou tout colis explicitement rattaché à
            ce code sera comptabilisé au Partenaire pour le calcul des commissions.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 4 — Rémunération</h3>
          <p>{commissionDescription(partner.commissionModel, partner.commissionRate, partner.currency)}</p>
          <p className="mt-2">
            Les commissions sont retracées en temps réel dans le compte courant du Partenaire, accessible depuis
            son portail dédié. Les versements sont effectués à la demande du Partenaire, par Mobile Money,
            virement bancaire ou espèces, selon convenance.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 5 — Obligations du Partenaire</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Représenter AFRYNTIX avec professionnalisme et honnêteté auprès de la clientèle ;</li>
            <li>Ne pas s'engager au nom d'AFRYNTIX sur des tarifs, délais ou conditions hors du cadre convenu ;</li>
            <li>Respecter la confidentialité des données clients ;</li>
            <li>Communiquer immédiatement à AFRYNTIX toute réclamation, litige ou incident dont il aurait connaissance ;</li>
            <li>Respecter les lois en vigueur dans son pays d'activité, notamment en matière fiscale.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 6 — Obligations d'AFRYNTIX</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Assurer la prise en charge logistique de bout en bout des colis apportés par le Partenaire ;</li>
            <li>Calculer et verser les commissions selon les modalités définies à l'article 4 ;</li>
            <li>Fournir au Partenaire un accès à un portail de suivi en temps réel ;</li>
            <li>Notifier le Partenaire à chaque étape clé (commission gagnée, versement effectué).</li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 7 — Durée &amp; résiliation</h3>
          <p>
            Le présent contrat est conclu pour une durée indéterminée à compter de sa date de signature.
            Chaque partie peut le résilier à tout moment, moyennant un préavis écrit (email ou WhatsApp) de
            trente (30) jours. Les commissions acquises avant la résiliation restent dues au Partenaire.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 8 — Confidentialité</h3>
          <p>
            Chaque partie s'engage à garder strictement confidentielles toutes les informations échangées dans
            le cadre du présent contrat, et à ne pas les divulguer à des tiers sans accord écrit préalable.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="font-bold uppercase mb-2">Article 9 — Droit applicable &amp; litiges</h3>
          <p>
            Le présent contrat est régi par le droit ivoirien. Tout litige survenant à l'occasion de son
            exécution sera, à défaut d'accord amiable, soumis aux tribunaux compétents d'Abidjan.
          </p>
        </section>

        {/* Signatures */}
        <section className="mt-12">
          <p className="mb-8">
            Fait à <span className="border-b border-black inline-block min-w-[150px]">&nbsp;</span>{" "}, le{" "}
            <strong>{formatDate(today)}</strong>, en deux (2) exemplaires originaux dont un pour chaque partie.
          </p>

          <div className="grid grid-cols-2 gap-12 mt-12">
            <div>
              <p className="font-bold uppercase">Pour AFRYNTIX SARL</p>
              <p className="text-xs italic mt-1">(Nom, prénom, signature et cachet)</p>
              <div className="border-b border-black h-24 mt-4" />
              <div className="border-b border-black mt-8" />
            </div>
            <div>
              <p className="font-bold uppercase">Pour le Partenaire</p>
              <p className="text-xs italic mt-1">({partner.contactName} — signature et cachet)</p>
              <div className="border-b border-black h-24 mt-4" />
              <div className="border-b border-black mt-8" />
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 mt-16 pt-4 border-t">
          AFRYNTIX SARL — Contrat n° {partner.code} — Code parrain {partner.referralCode}
        </footer>
      </article>

      {/* Styles d'impression */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
