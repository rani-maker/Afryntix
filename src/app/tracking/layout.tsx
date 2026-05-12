import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suivi de colis",
  description:
    "Suivez votre colis en temps réel grâce à votre numéro de suivi AFRYNTIX. Fret aérien et maritime Chine — Afrique de l'Ouest.",
  openGraph: {
    title: "Suivi de colis | AFRYNTIX",
    description:
      "Suivez votre colis en temps réel grâce à votre numéro de suivi AFRYNTIX. Fret aérien et maritime Chine — Afrique de l'Ouest.",
    url: "/tracking",
    images: [{ url: "/images/tracking.jpg", width: 1200, height: 630, alt: "Suivi de colis AFRYNTIX" }],
  },
  alternates: { canonical: "/tracking" },
};

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
