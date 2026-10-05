"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { requestPasswordReset } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/login" />
      <div className="flex items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <Logo variant="md" className="h-10 w-auto" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="afx-kicker">Récupération de compte</span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Mot de passe oublié ?
            </h1>
            <p className="text-sm text-ink-2">
              Saisissez l&apos;email associé à votre compte. Nous vous enverrons un lien
              pour choisir un nouveau mot de passe.
            </p>
          </div>

          {done ? (
            <div className="rounded-xl bg-mint-1/30 border border-mint-2/50 p-4 text-sm">
              <p className="font-semibold text-ink-1 mb-1">Email envoyé.</p>
              <p className="text-ink-2">
                Si un compte existe pour cet email, vous recevrez un lien de
                réinitialisation sous quelques minutes. Vérifiez aussi votre dossier
                spam. Le lien est valable 60 minutes.
              </p>
              <Link
                href="/login"
                className="inline-block mt-3 text-mint-3 font-semibold underline underline-offset-4"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
              </Button>
              <p className="text-sm text-center text-ink-2">
                <Link
                  href="/login"
                  className="text-mint-3 font-semibold underline underline-offset-4 hover:text-mint-2"
                >
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
