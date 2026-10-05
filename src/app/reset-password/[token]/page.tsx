import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/public-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type Params = { token: string };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;

  // Pré-check côté serveur pour afficher l'erreur sans forcer un POST inutile
  const record =
    token.length === 64
      ? await prisma.passwordResetToken.findUnique({
          where: { token },
          select: { expiresAt: true, usedAt: true, user: { select: { email: true, active: true } } },
        })
      : null;

  const invalid = !record;
  const expired = !invalid && record!.expiresAt < new Date();
  const used = !invalid && record!.usedAt !== null;
  const inactive = !invalid && !record!.user.active;
  const problem = invalid || expired || used || inactive;

  const problemMessage = invalid
    ? "Ce lien de réinitialisation est invalide."
    : used
      ? "Ce lien a déjà été utilisé."
      : expired
        ? "Ce lien a expiré. Demandez-en un nouveau."
        : inactive
          ? "Ce compte est désactivé. Contactez le support AFRYNTIX."
          : null;

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
              Choisissez un mot de passe
            </h1>
            {!problem && (
              <p className="text-sm text-ink-2">
                Pour le compte&nbsp;
                <strong className="text-ink-1">{record!.user.email}</strong>.
                Minimum 8 caractères.
              </p>
            )}
          </div>

          {problem ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
              <p className="font-semibold text-amber-900 mb-1">Lien non valide</p>
              <p className="text-amber-800">{problemMessage}</p>
              <Link
                href="/forgot-password"
                className="inline-block mt-3 text-mint-3 font-semibold underline underline-offset-4"
              >
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <ResetPasswordForm token={token} />
          )}
        </div>
      </div>
    </main>
  );
}
