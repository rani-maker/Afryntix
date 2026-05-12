"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { updateProfile, changePassword } from "@/server/actions/auth";

type Initial = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  country: string;
  address: string;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [city, setCity] = useState(initial.city);
  const [country, setCountry] = useState(initial.country);
  const [address, setAddress] = useState(initial.address);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const res = await updateProfile({
      name,
      phone,
      whatsapp: whatsapp || undefined,
      city: city || undefined,
      country: country || undefined,
      address: address || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email (non modifiable)</Label>
          <Input id="email" value={initial.email} disabled />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone</Label>
        <PhoneInput id="phone" required value={phone} onChange={setPhone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp</Label>
        <PhoneInput id="whatsapp" value={whatsapp} onChange={setWhatsapp} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Adresse de livraison par défaut</Label>
        <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">Profil mis à jour.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) {
      setError("La confirmation ne correspond pas.");
      return;
    }
    setLoading(true);
    const res = await changePassword({ current, next });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="current">Mot de passe actuel</Label>
        <Input id="current" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next">Nouveau mot de passe</Label>
        <Input id="next" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmer</Label>
        <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">Mot de passe modifié.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
