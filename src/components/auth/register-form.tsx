"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
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
    const result = await registerClient({
      name: String(fd.get("name")),
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      phone,
      whatsapp: whatsapp.length >= 8 ? whatsapp : phone,
      city: String(fd.get("city") || ""),
      country: String(fd.get("country") || ""),
    });
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    const signInRes = await signIn("credentials", {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (signInRes?.error) {
      setError("Compte créé mais connexion échouée. Veuillez vous connecter.");
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création..." : "Créer mon compte"}
      </Button>
    </form>
  );
}
