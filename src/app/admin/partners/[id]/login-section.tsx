"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createPartnerLogin, resetPartnerPassword } from "@/server/actions/partners";

export function LoginSection({
  partnerId,
  currentEmail,
  hasUser,
  userActive,
  userEmail,
}: {
  partnerId: string;
  currentEmail: string | null;
  hasUser: boolean;
  userActive: boolean;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(currentEmail ?? "");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleCreate() {
    setErr(null);
    setTempPassword(null);
    if (!email.includes("@")) {
      setErr("Email invalide.");
      return;
    }
    start(async () => {
      const res = await createPartnerLogin(partnerId, email);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setTempPassword(res.data!.password);
      router.refresh();
    });
  }

  function handleReset() {
    if (!confirm("Régénérer un nouveau mot de passe ? L'ancien sera invalidé.")) return;
    setErr(null);
    setTempPassword(null);
    start(async () => {
      const res = await resetPartnerPassword(partnerId);
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setTempPassword(res.data!.password);
      router.refresh();
    });
  }

  if (hasUser) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={userActive ? "success" : "destructive"}>
            {userActive ? "Compte actif" : "Désactivé"}
          </Badge>
          <span className="font-mono text-xs">{userEmail}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Le partenaire peut se connecter sur <code>/login</code> avec cet email. Il accède ensuite à son portail <code>/partner</code>.
        </p>
        <Button variant="outline" disabled={pending} onClick={handleReset}>
          {pending ? "…" : "Régénérer le mot de passe"}
        </Button>
        {tempPassword && (
          <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-sm">
            <div className="font-medium text-amber-900">Nouveau mot de passe temporaire</div>
            <code className="block mt-1 font-mono text-base font-bold text-amber-900">{tempPassword}</code>
            <p className="text-xs text-amber-700 mt-2">
              Notez-le maintenant — il a aussi été envoyé par WhatsApp au partenaire.
            </p>
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Créer un accès pour que ce partenaire puisse se connecter à son portail <code>/partner</code> et suivre ses colis et commissions.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="loginEmail">Email de connexion</Label>
        <Input
          id="loginEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partenaire@example.com"
        />
      </div>
      <Button disabled={pending} onClick={handleCreate}>
        {pending ? "Création…" : "Créer le compte partenaire"}
      </Button>
      {tempPassword && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 text-sm">
          <div className="font-medium text-emerald-900">Compte créé</div>
          <div className="mt-1 text-emerald-800">
            Email : <code className="font-mono">{email}</code>
          </div>
          <div className="text-emerald-800">
            Mot de passe : <code className="font-mono font-bold text-base">{tempPassword}</code>
          </div>
          <p className="text-xs text-emerald-700 mt-2">
            Identifiants également envoyés par WhatsApp.
          </p>
        </div>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
