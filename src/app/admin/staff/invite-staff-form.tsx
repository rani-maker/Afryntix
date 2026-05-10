"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteStaff } from "@/server/actions/auth";

export function InviteStaffForm() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setLoading(true);
    const res = await inviteStaff(email);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setLink(res.data?.inviteUrl ?? null);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div className="space-y-1.5">
        <Label htmlFor="staffEmail">Email du futur Staff</Label>
        <div className="flex gap-2">
          <Input
            id="staffEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@afryntix.com"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Envoi…" : "Inviter"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 text-sm">
          <div className="font-medium text-emerald-900">Invitation créée — lien valable 7 jours :</div>
          <code className="block mt-1 text-xs break-all text-emerald-800">{link}</code>
          <p className="text-xs text-emerald-700 mt-2">
            Communiquez ce lien à la personne invitée par WhatsApp ou email.
          </p>
        </div>
      )}
    </form>
  );
}
