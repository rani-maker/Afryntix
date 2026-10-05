"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordResetOtp } from "@/server/actions/auth";

export function ResetPasswordOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const otpId = params.get("otp") ?? "";

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otpId) {
      setError("Session de vérification manquante. Recommencez via « Mot de passe oublié ? ».");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await confirmPasswordResetOtp({ otpId, code, password });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <div className="rounded-xl bg-mint-1/30 border border-mint-2/50 p-4 text-sm">
        <p className="font-semibold text-ink-1 mb-1">
          Mot de passe mis à jour.
        </p>
        <p className="text-ink-2">
          Vous allez être redirigé vers la page de connexion…
        </p>
        <Link
          href="/login"
          className="inline-block mt-3 text-mint-3 font-semibold underline underline-offset-4"
        >
          Se connecter maintenant
        </Link>
      </div>
    );
  }

  if (!otpId) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
        <p className="font-semibold text-amber-900 mb-1">Code manquant</p>
        <p className="text-amber-800">
          Vous devez d&apos;abord demander un code via « Mot de passe oublié ? ».
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-3 text-mint-3 font-semibold underline underline-offset-4"
        >
          Demander un code
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code à 6 chiffres reçu sur WhatsApp</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoComplete="one-time-code"
          autoFocus
          className="text-center text-2xl tracking-[0.6em] font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <Input
          id="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || code.length !== 6}
      >
        {loading ? "Enregistrement…" : "Vérifier et changer mon mot de passe"}
      </Button>
    </form>
  );
}
