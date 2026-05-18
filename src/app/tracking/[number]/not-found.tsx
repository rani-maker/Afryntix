import Link from "next/link";
import { ArrowLeft, SearchX, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { TrackingSearchForm } from "@/components/tracking/tracking-search-form";

export default function TrackingNotFound() {
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/tracking" />

      <section className="container px-6 md:px-12 py-16 max-w-3xl">
        <div className="flex flex-col items-center text-center gap-6">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ background: "var(--afx-bg-2)" }}
          >
            <SearchX className="h-8 w-8 text-ink-3" />
          </div>

          <div className="flex flex-col gap-3">
            <span className="afx-kicker">SUIVI INTROUVABLE</span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Aucun colis trouvé pour ce numéro
            </h1>
            <p className="text-ink-2 max-w-[520px] mx-auto">
              Vérifiez le format du numéro de suivi (ex&nbsp;:
              <span className="font-mono text-ink-2"> AFR-A-2026-123456</span> ou
              <span className="font-mono text-ink-2"> AFR-M-2026-...</span>). Si vous venez
              d&apos;effectuer une réservation, le numéro de suivi n&apos;est généré qu&apos;à la
              validation par notre équipe.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-line bg-surface p-5 shadow-brand-md text-left">
            <span className="afx-kicker" style={{ color: "var(--afx-ink)" }}>
              Nouvelle recherche
            </span>
            <div className="mt-3">
              <TrackingSearchForm />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
              <Link href="/tracking">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Page de suivi
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-line-2"
            >
              <a
                href="https://wa.me/8617876195266"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1 text-[#25D366]" /> Contacter le
                support
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
