"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { requestPasswordResetOtp } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = await requestPasswordResetOtp(identifier);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    // Toujours success pour éviter l'énumération. Si otpId existe → page OTP.
    // Sinon on affiche quand même le message "si un compte existe…".
    if (res.data?.otpId) {
      router.push(`/reset-password?otp=${encodeURIComponent(res.data.otpId)}`);
      return;
    }
    setInfo(
      "Si un compte existe avec cet identifiant, un code de vérification vient d'être envoyé sur WhatsApp au numéro enregistré. Entrez ce code sur la page de réinitialisation.",
    );
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
              Saisissez votre email ou numéro de téléphone enregistré à
              l&apos;inscription. Vous recevrez un code de vérification à 6
              chiffres sur WhatsApp.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email ou téléphone</Label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="vous@exemple.com ou +225…"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && (
              <div className="rounded-xl bg-mint-1/30 border border-mint-2/50 p-3 text-sm text-ink-2">
                {info}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi…" : "Recevoir mon code WhatsApp"}
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
        </div>
      </div>
    </main>
  );
}
