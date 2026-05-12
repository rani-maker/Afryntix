"use client";

import { PublicHeader } from "@/components/public-header";

const LAST_UPDATE = "Mai 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader />

      <div className="container px-6 md:px-12 py-14 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-10 pb-8 border-b border-line">
          <span className="afx-kicker">Légal</span>
          <h1 className="afx-h1">Politique de Confidentialité</h1>
          <p className="text-sm text-ink-3">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>

        <div className="prose-privacy flex flex-col gap-10">

          {/* 1 */}
          <Section title="1. Identité du responsable du traitement">
            <p>
              <strong>AFRYNTIX SAS</strong> est responsable du traitement de vos données personnelles
              collectées via la plateforme accessible à l'adresse{" "}
              <a href="https://afryntix.com" className="text-mint-3 hover:underline">afryntix.com</a>.
            </p>
            <ul>
              <li><strong>Siège social :</strong> Abidjan, Côte d'Ivoire</li>
              <li><strong>Bureau Chine :</strong> Guangzhou, Province du Guangdong, Chine</li>
              <li>
                <strong>Contact :</strong>{" "}
                <a href="mailto:contact@afryntix.com" className="text-mint-3 hover:underline">
                  contact@afryntix.com
                </a>
              </li>
            </ul>
          </Section>

          {/* 2 */}
          <Section title="2. Données collectées">
            <p>
              Dans le cadre de nos services de transport et logistique (fret aérien, maritime,
              transport de véhicules, équipements BTP, stockage), nous collectons les données suivantes :
            </p>
            <SubSection title="Lors de la création de compte">
              <ul>
                <li>Nom et prénom</li>
                <li>Adresse e-mail</li>
                <li>Numéro de téléphone / WhatsApp</li>
                <li>Mot de passe (chiffré — non accessible en clair)</li>
              </ul>
            </SubSection>
            <SubSection title="Lors d'une expédition ou réservation">
              <ul>
                <li>Coordonnées de l'expéditeur et du destinataire</li>
                <li>Description, poids, dimensions et photos des marchandises</li>
                <li>Informations de facturation et de paiement</li>
                <li>Historique des statuts d'expédition</li>
              </ul>
            </SubSection>
            <SubSection title="Automatiquement lors de votre navigation">
              <ul>
                <li>Adresse IP</li>
                <li>Type de navigateur et appareil</li>
                <li>Pages consultées et durée de visite</li>
              </ul>
            </SubSection>
          </Section>

          {/* 3 */}
          <Section title="3. Finalités du traitement">
            <table>
              <thead>
                <tr>
                  <th>Finalité</th>
                  <th>Base légale</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gestion de votre compte client", "Exécution du contrat"],
                  ["Traitement et suivi de vos expéditions", "Exécution du contrat"],
                  ["Notifications WhatsApp sur l'état de vos colis", "Exécution du contrat"],
                  ["Émission de factures et gestion des paiements", "Obligation légale"],
                  ["Prévention de la fraude et sécurité", "Intérêt légitime"],
                  ["Amélioration de nos services", "Intérêt légitime"],
                  ["Communications commerciales (avec votre accord)", "Consentement"],
                ].map(([f, b]) => (
                  <tr key={f}>
                    <td>{f}</td>
                    <td>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 4 */}
          <Section title="4. Partage des données">
            <p>
              Vos données personnelles ne sont <strong>jamais vendues</strong> à des tiers. Elles
              peuvent être partagées uniquement avec :
            </p>
            <ul>
              <li>
                <strong>Partenaires logistiques</strong> (transporteurs, douanes, entrepôts) dans le
                strict cadre de l'acheminement de vos marchandises
              </li>
              <li>
                <strong>Prestataires techniques</strong> (hébergement Supabase/AWS, messagerie
                WhatsApp) soumis à des obligations contractuelles de confidentialité
              </li>
              <li>
                <strong>Autorités compétentes</strong> si la loi l'exige (douanes, administrations
                fiscales ivoiriennes ou chinoises)
              </li>
            </ul>
          </Section>

          {/* 5 */}
          <Section title="5. Transferts internationaux">
            <p>
              Dans le cadre de notre activité Chine – Afrique de l'Ouest, vos données peuvent être
              transférées entre la Côte d'Ivoire, la Chine et des serveurs hébergés dans l'Union
              Européenne (AWS eu-west-1). Ces transferts sont encadrés par des clauses contractuelles
              types garantissant un niveau de protection équivalent.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Durée de conservation">
            <table>
              <thead>
                <tr>
                  <th>Type de données</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Données de compte actif", "Pendant toute la durée du compte"],
                  ["Données d'expéditions et factures", "10 ans (obligation comptable)"],
                  ["Données de navigation", "13 mois maximum"],
                  ["Données de compte clôturé", "3 ans après clôture"],
                ].map(([t, d]) => (
                  <tr key={t}>
                    <td>{t}</td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 7 */}
          <Section title="7. Vos droits">
            <p>Conformément aux réglementations applicables, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Accès :</strong> obtenir une copie de vos données</li>
              <li><strong>Rectification :</strong> corriger des données inexactes</li>
              <li>
                <strong>Suppression :</strong> demander l'effacement de vos données (sauf obligations
                légales contraires)
              </li>
              <li><strong>Opposition :</strong> vous opposer à certains traitements</li>
              <li>
                <strong>Portabilité :</strong> recevoir vos données dans un format structuré
              </li>
              <li>
                <strong>Retrait du consentement :</strong> à tout moment pour les communications
                marketing
              </li>
            </ul>
            <p>
              <strong>Pour exercer ces droits :</strong> envoyez un e-mail à{" "}
              <a href="mailto:contact@afryntix.com" className="text-mint-3 hover:underline">
                contact@afryntix.com
              </a>{" "}
              avec une copie d'une pièce d'identité. Nous nous engageons à répondre dans un délai de{" "}
              <strong>30 jours</strong>.
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Sécurité des données">
            <p>AFRYNTIX met en œuvre les mesures suivantes pour protéger vos données :</p>
            <ul>
              <li>Chiffrement des mots de passe (bcrypt)</li>
              <li>Connexions HTTPS/TLS sur l'ensemble de la plateforme</li>
              <li>Accès aux données limité aux seuls employés autorisés</li>
              <li>Base de données hébergée sur infrastructure sécurisée (Supabase/AWS)</li>
              <li>Authentification par jeton sécurisé (JWT)</li>
            </ul>
          </Section>

          {/* 9 */}
          <Section title="9. Cookies">
            <p>
              Notre site utilise uniquement des cookies techniques nécessaires au fonctionnement de la
              plateforme (session de connexion, préférences de langue et de thème). Aucun cookie
              publicitaire ou de tracking tiers n'est utilisé.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Modifications">
            <p>
              Nous nous réservons le droit de modifier cette politique à tout moment. Les utilisateurs
              enregistrés seront informés par e-mail de toute modification substantielle. La date de
              dernière mise à jour figure en haut de ce document.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Contact et réclamations">
            <ul>
              <li>
                <strong>E-mail :</strong>{" "}
                <a href="mailto:contact@afryntix.com" className="text-mint-3 hover:underline">
                  contact@afryntix.com
                </a>
              </li>
              <li>
                <strong>WhatsApp :</strong>{" "}
                <a href="tel:+2250706260405" className="text-mint-3 hover:underline">
                  +225 0706260405
                </a>
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Footer bar */}
      <div className="border-t border-line bg-surface-2/60 px-6 md:px-12 py-6">
        <div className="container text-center text-sm text-ink-3">
          © {new Date().getFullYear()} AFRYNTIX SAS · Tous droits réservés
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-ink tracking-tight border-b border-line pb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[15px] text-ink-2 leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}
