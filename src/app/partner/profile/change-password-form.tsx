"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/server/actions/auth";

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (next !== confirm) {
      setErr("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }
    if (next.length < 8) {
      setErr("Le nouveau mot de passe doit faire au moins 8 caractères.");
      setLoading(false);
      return;
    }
    const res = await changePassword({ current, next });
    setLoading(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg("Mot de passe mis à jour.");
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="current">Mot de passe actuel</Label>
        <Input id="current" name="current" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next">Nouveau mot de passe (min. 8 caractères)</Label>
        <Input id="next" name="next" type="password" required minLength={8} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
