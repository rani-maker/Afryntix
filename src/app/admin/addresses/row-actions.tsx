"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleAddress, deleteAddress } from "@/server/actions/addresses";

export function AddressRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => {
          await toggleAddress({ id, active: !active });
        })}
      >
        {active ? "Désactiver" : "Activer"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm("Supprimer cette adresse ?")) return;
          start(async () => {
            await deleteAddress({ id });
          });
        }}
      >
        Supprimer
      </Button>
    </div>
  );
}
