"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";

export default function TrackingDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/tracking" />
      <section className="container px-6 md:px-12 py-16 max-w-3xl">
        <div className="flex flex-col items-center text-center gap-6">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ background: "var(--afx-bg-2)" }}
          >
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div className="flex flex-col gap-3">
            <span className="afx-kicker">SUIVI · ERREUR</span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Impossible d&apos;afficher le suivi
            </h1>
            <p className="text-ink-2 max-w-[520px] mx-auto">
              Une erreur s&apos;est produite lors du chargement de ce colis. Réessayez ou
              revenez à la recherche.
            </p>
          </div>

          {error?.message && (
            <pre className="w-full max-w-2xl text-left text-[12px] font-mono p-4 rounded-xl border border-line bg-surface overflow-auto text-ink-3">
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ""}
            </pre>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => reset()} size="sm" className="rounded-full">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Réessayer
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full border-line-2">
              <Link href="/tracking">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle recherche
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
