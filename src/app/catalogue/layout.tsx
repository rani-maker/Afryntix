import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catalogues Sanitaire, Déco & Luminaire, Meuble",
  description:
    "Consultez les catalogues AFRYNTIX — sanitaire, décoration, luminaire et meuble — et commandez en ligne : achat en Chine, livraison en Afrique de l'Ouest.",
  keywords: [
    "catalogue sanitaire Chine Abidjan",
    "luminaire Chine Côte d'Ivoire",
    "meuble importation Chine",
    "décoration Chine Afrique de l'Ouest",
  ],
  openGraph: {
    title: "Catalogues | AFRYNTIX",
    description: "Sanitaire, Déco & Luminaire, Meuble : consultez nos catalogues et commandez en ligne.",
    url: "/catalogue",
  },
  alternates: { canonical: "/catalogue" },
};

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
