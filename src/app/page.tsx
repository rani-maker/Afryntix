import type { Metadata } from "next";
import { HomePageClient } from "@/components/home/home-page-client";

export const metadata: Metadata = {
  title: {
    absolute: "AFRYNTIX — Transport & Logistique Chine · Afrique de l'Ouest",
  },
  description:
    "Fret aérien, fret maritime, envoi express, transport de véhicules et engins BTP, paiement de factures fournisseurs Chine ↔ Côte d'Ivoire et Afrique de l'Ouest.",
  openGraph: {
    title: "AFRYNTIX — Transport & Logistique Chine · Afrique de l'Ouest",
    description:
      "Fret aérien, fret maritime, envoi express, transport de véhicules et engins BTP, paiement de factures fournisseurs Chine ↔ Côte d'Ivoire.",
    url: "/",
    images: [{ url: "/images/banner-1.jpg", width: 1200, height: 630, alt: "AFRYNTIX — Transport & Logistique" }],
  },
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomePageClient />;
}
