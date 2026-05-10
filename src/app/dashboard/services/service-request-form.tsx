"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createServiceRequest } from "@/server/actions/services";

const TYPES: Array<{ value: string; label: string }> = [
  { value: "QUALITY_CONTROL", label: "Contrôle qualité" },
  { value: "PURCHASING", label: "Achat / Sourcing" },
  { value: "VEHICLE_SALE", label: "Achat véhicule" },
  { value: "BTP_SALE", label: "Achat engin BTP" },
  { value: "TRADING", label: "Paiement de facture" },
  { value: "INTRODUCTION", label: "Négoce" },
];

export function ServiceRequestForm({
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [type, setType] = useState(TYPES[0].value);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await createServiceRequest({
      type,
      clientName: name,
      clientEmail: email || undefined,
      clientPhone: phone,
      budget: budget || undefined,
      message,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setSuccess(res.data.reference);
      setMessage("");
      setBudget("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type de service</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget">Budget envisagé (optionnel)</Label>
          <Input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="ex: 1 000 000 FCFA" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Détails de votre demande</Label>
        <Textarea
          id="message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez votre besoin (références produits, quantités, contraintes…)"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-700">
          Demande enregistrée — référence <span className="font-mono font-bold">{success}</span>. Notre équipe vous recontacte sous 24h.
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi…" : "Envoyer la demande"}
      </Button>
    </form>
  );
}
