import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { VerifySignupForm } from "@/components/auth/verify-signup-form";

export default function VerifySignupPage() {
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/login" />
      <div className="flex items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <Logo variant="md" className="h-10 w-auto" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="afx-kicker">Vérification WhatsApp</span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Saisissez votre code
            </h1>
            <p className="text-sm text-ink-2">
              Nous avons envoyé un code à 6 chiffres sur WhatsApp au numéro
              fourni à l&apos;inscription. Il expire dans 10 minutes.
            </p>
          </div>
          <VerifySignupForm />
          <p className="text-sm text-center text-ink-2">
            <Link
              href="/login"
              className="text-mint-3 font-semibold underline underline-offset-4 hover:text-mint-2"
            >
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
