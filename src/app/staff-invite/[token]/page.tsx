import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, ShieldAlert, Clock, Users } from "lucide-react";
import { AcceptInviteForm } from "./accept-invite-form";
import { Logo } from "@/components/brand/logo";

export default async function StaffInviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.staffInvite.findUnique({
    where: { token },
    include: { invitedBy: { select: { name: true } } },
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--afx-bg)] p-4">
      <div className="afx-motif-bg absolute inset-0 opacity-50 -z-0" />
      <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface shadow-brand-lg overflow-hidden">
        <div className="afx-surface-night px-7 py-6">
          <div className="flex items-center gap-3 text-white">
            <Logo variant="sm" tone="dark" className="h-9 w-auto" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-mint">
                INVITATION STAFF
              </span>
              <span className="text-sm font-semibold">Rejoindre l'équipe AFRYNTIX</span>
            </div>
          </div>
        </div>

        <div className="px-7 py-7 flex flex-col gap-5">
          {!invite ? (
            <InviteState
              icon={ShieldAlert}
              tone="error"
              title="Invitation invalide"
              message="Cette invitation est invalide ou a été révoquée."
            />
          ) : invite.usedById ? (
            <InviteState
              icon={Clock}
              tone="warning"
              title="Invitation déjà utilisée"
              message="Cette invitation a déjà été acceptée. Vous pouvez vous connecter directement."
              ctaLabel="Aller à la connexion"
              ctaHref="/login"
            />
          ) : invite.expiresAt < new Date() ? (
            <InviteState
              icon={Clock}
              tone="error"
              title="Invitation expirée"
              message="Cette invitation a expiré. Demandez-en une nouvelle à un administrateur."
            />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="afx-kicker">BIENVENUE</span>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  Définissez votre mot de passe
                </h1>
              </div>
              <div className="rounded-xl bg-mint-pale border border-mint-soft p-4 flex items-start gap-3">
                <Users className="h-4 w-4 text-mint-3 mt-0.5 shrink-0" />
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  Vous êtes invité par{" "}
                  <span className="font-semibold text-ink">
                    {invite.invitedBy.name}
                  </span>{" "}
                  à rejoindre l'espace Staff avec l'adresse{" "}
                  <span className="font-mono font-semibold text-ink">
                    {invite.email}
                  </span>
                  .
                </p>
              </div>
              <AcceptInviteForm token={token} email={invite.email} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function InviteState({
  icon: Icon,
  tone,
  title,
  message,
  ctaLabel,
  ctaHref,
}: {
  icon: typeof ShieldAlert;
  tone: "error" | "warning";
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const palette =
    tone === "error"
      ? { bg: "bg-red-50", border: "border-red-200", color: "text-red-700" }
      : { bg: "bg-amber-50", border: "border-amber-200", color: "text-amber-800" };
  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-xl ${palette.bg} ${palette.border} border p-4 flex items-start gap-3`}
      >
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${palette.color}`} />
        <div className="flex flex-col gap-1">
          <span className={`text-sm font-semibold ${palette.color}`}>{title}</span>
          <span className="text-[13px] text-ink-2 leading-relaxed">{message}</span>
        </div>
      </div>
      <Link
        href={ctaHref ?? "/login"}
        className="inline-flex items-center gap-2 text-[13px] text-mint-3 font-semibold hover:text-mint-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {ctaLabel ?? "Retour à la connexion"}
      </Link>
    </div>
  );
}
