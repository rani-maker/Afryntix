import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nos services",
  description:
    "Fret aérien express, fret maritime LCL & FCL, transport de véhicules, engins BTP, sourcing Chine, paiement fournisseurs — AFRYNTIX Chine–Côte d'Ivoire.",
  keywords: [
    "fret aérien Chine Abidjan",
    "fret maritime LCL FCL Chine",
    "transport véhicule Chine Afrique",
    "sourcing Chine",
    "paiement fournisseur Chine",
    "engins BTP Chine Côte d'Ivoire",
  ],
  openGraph: {
    title: "Nos services | AFRYNTIX",
    description:
      "Fret aérien express, fret maritime LCL & FCL, transport de véhicules, engins BTP, sourcing Chine, paiement fournisseurs.",
    url: "/services",
    images: [{ url: "/images/service-banner.jpg", width: 1200, height: 630, alt: "Services AFRYNTIX" }],
  },
  alternates: { canonical: "/services" },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
