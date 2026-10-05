import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { ResetPasswordOtpForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/login" />
      <div className="flex items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <Logo variant="md" className="h-10 w-auto" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="afx-kicker">Nouveau mot de passe</span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Vérification et nouveau mot de passe
            </h1>
            <p className="text-sm text-ink-2">
              Saisissez le code à 6 chiffres reçu sur WhatsApp puis choisissez
              un nouveau mot de passe. Minimum 8 caractères.
            </p>
          </div>
          <ResetPasswordOtpForm />
          <p className="text-sm text-center text-ink-2">
            <Link
              href="/forgot-password"
              className="text-mint-3 font-semibold underline underline-offset-4 hover:text-mint-2"
            >
              Demander un nouveau code
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
