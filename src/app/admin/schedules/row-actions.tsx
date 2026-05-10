"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleScheduleActive, deleteSchedule } from "@/server/actions/schedules";

export function ScheduleRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => {
          await toggleScheduleActive({ id, active: !active });
        })}
      >
        {active ? "Désactiver" : "Activer"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm("Supprimer ce calendrier ?")) return;
          start(async () => {
            await deleteSchedule({ id });
          });
        }}
      >
        Supprimer
      </Button>
    </div>
  );
}
