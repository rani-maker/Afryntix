"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifySignupOtp, resendSignupOtp } from "@/server/actions/auth";

export function VerifySignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [otpId, setOtpId] = useState<string>(params.get("otp") ?? "");
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!otpId) {
      setError("Session de vérification manquante. Recommencez l'inscription.");
      return;
    }
    setLoading(true);
    const res = await verifySignupOtp({ otpId, code });
    if (!res.success) {
      setError(res.error);
      setLoading(false);
      return;
    }
    // OTP OK → signin auto avec le password gardé dans sessionStorage
    let password = "";
    try {
      password = sessionStorage.getItem("afx_pending_pw") ?? "";
      sessionStorage.removeItem("afx_pending_pw");
    } catch {}
    if (email && password) {
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (signInRes?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setLoading(false);
    router.push("/login");
  }

  async function handleResend() {
    if (!otpId) return;
    setResending(true);
    setError(null);
    setInfo(null);
    const res = await resendSignupOtp({ otpId });
    setResending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (res.data?.otpId) setOtpId(res.data.otpId);
    setInfo("Un nouveau code vient d'être envoyé sur WhatsApp.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code à 6 chiffres</Label>
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      {info && <p className="text-sm text-mint-3">{info}</p>}
      <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
        {loading ? "Vérification…" : "Vérifier et activer mon compte"}
      </Button>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || !otpId}
        className="w-full text-sm text-mint-3 font-semibold underline underline-offset-4 hover:text-mint-2 disabled:opacity-50"
      >
        {resending ? "Envoi en cours…" : "Renvoyer le code sur WhatsApp"}
      </button>
    </form>
  );
}
