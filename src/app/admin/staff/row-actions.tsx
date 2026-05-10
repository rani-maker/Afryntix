"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deactivateUser, reactivateUser } from "@/server/actions/auth";

export function StaffRowActions({ userId, active }: { userId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={active ? "outline" : "default"}
      disabled={pending}
      onClick={() => start(async () => {
        if (active) await deactivateUser(userId);
        else await reactivateUser(userId);
      })}
    >
      {pending ? "…" : active ? "Désactiver" : "Réactiver"}
    </Button>
  );
}
