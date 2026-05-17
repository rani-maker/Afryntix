"use client";
import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Valide une `callbackUrl` reçue en query string contre une open-redirect.
 * On n'accepte qu'un chemin RELATIF (commençant par `/`) interne à
 * l'application, et on rejette explicitement :
 *  - les URLs absolues (http://...) ou protocol-relative (`//evil.com`)
 *  - les ancrages JS (`javascript:`, `data:`)
 *  - les chemins backslash (`\evil.com`)
 */
function safeCallbackUrl(raw: string | null): string | null {
  if (!raw) return null;
  // Doit commencer par exactement un `/` et ne pas être protocol-relative.
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Refuse les schémas dangereux qui auraient survécu à un encodage farfelu.
  const lower = raw.toLowerCase().trimStart();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    // Redirection selon le rôle
    const session = await getSession();
    const role = (session?.user as { role?: string })?.role;
    if (callbackUrl) {
      router.push(callbackUrl);
    } else if (role === "ADMIN") {
      router.push("/admin");
    } else if (role === "STAFF") {
      router.push("/staff");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Connexion..." : "Se connecter"}
      </Button>
    </form>
  );
}
