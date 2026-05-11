"use client";
import { LogOut } from "lucide-react";
import { serverSignOut } from "@/server/actions/auth";

export function SignOutButton() {
  return (
    <button
      onClick={() => serverSignOut()}
      className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
    >
      <LogOut className="h-4 w-4" /> Déconnexion
    </button>
  );
}
