"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { registerClient } from "@/server/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("+225");
  const [whatsapp, setWhatsapp] = useState("+225");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!phone.startsWith("+") || phone.length < 8) {
      setError("Le numéro de téléphone doit inclure l'indicatif du pays (ex : +225 0706260405).");
      return;
    }

    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const result = await registerClient({
      name: String(fd.get("name")),
      email,
      password,
      phone,
      whatsapp: whatsapp.length >= 8 ? whatsapp : phone,
      city: String(fd.get("city") || ""),
      country: String(fd.get("country") || ""),
      referralCode: String(fd.get("referralCode") || "") || undefined,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Compte créé → envoi vers la page de saisie OTP (un code vient de partir
    // sur WhatsApp au numéro saisi). Le signIn se fera après vérification.
    const otpId = result.data?.otpId;
    if (!otpId) {
      setError("Le code n'a pas pu être envoyé. Essayez de vous connecter puis de renvoyer un code.");
      router.push("/login");
      return;
    }
    const params = new URLSearchParams({
      otp: otpId,
      email,
      // mdp temporairement passé via sessionStorage (jamais via URL) pour auto-login post vérif
    });
    try {
      sessionStorage.setItem("afx_pending_pw", password);
    } catch {}
    router.push(`/register/verify?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nom complet</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">
          Téléphone <span className="text-destructive">*</span>
        </Label>
        <PhoneInput id="phone" required value={phone} onChange={setPhone} />
        <p className="text-[11px] text-muted-foreground">
          Sélectionnez votre pays puis entrez le numéro sans le zéro initial.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp</Label>
        <PhoneInput id="whatsapp" value={whatsapp} onChange={setWhatsapp} />
        <p className="text-[11px] text-muted-foreground">
          Laissez vide pour utiliser le même numéro que le téléphone.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" defaultValue="Côte d'Ivoire" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="referralCode" className="flex items-center gap-1">
          Code parrain <span className="text-xs text-muted-foreground font-normal">(optionnel)</span>
        </Label>
        <Input
          id="referralCode"
          name="referralCode"
          placeholder="Ex: BOUAKE-DIALLO-A3F2"
          className="font-mono"
        />
        <p className="text-[11px] text-muted-foreground">
          Si un partenaire AFRYNTIX vous a recommandé, saisissez son code ici.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création..." : "Créer mon compte"}
      </Button>
    </form>
  );
}
