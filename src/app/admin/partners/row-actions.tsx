"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PartnerStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { activatePartner, setPartnerStatus } from "@/server/actions/partners";

export function PartnerRowActions({
  partnerId,
  status,
}: {
  partnerId: string;
  status: PartnerStatus;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.success && res.error) alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {status === "PENDING" && (
        <Button
          size="sm"
          variant="default"
          disabled={pending}
          onClick={() => run(() => activatePartner(partnerId))}
        >
          Activer
        </Button>
      )}
      {status === "ACTIVE" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setPartnerStatus(partnerId, "SUSPENDED"))}
        >
          Suspendre
        </Button>
      )}
      {status === "SUSPENDED" && (
        <Button
          size="sm"
          variant="default"
          disabled={pending}
          onClick={() => run(() => setPartnerStatus(partnerId, "ACTIVE"))}
        >
          Réactiver
        </Button>
      )}
      {status !== "TERMINATED" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm("Résilier ce partenariat ? Cette action peut être annulée plus tard.")) {
              run(() => setPartnerStatus(partnerId, "TERMINATED"));
            }
          }}
          className="text-red-600 hover:text-red-700"
        >
          Résilier
        </Button>
      )}
      {status === "TERMINATED" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => setPartnerStatus(partnerId, "PENDING"))}
        >
          Restaurer
        </Button>
      )}
    </div>
  );
}
