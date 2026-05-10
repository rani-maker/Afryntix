"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { updateServiceStatus } from "@/server/actions/services";
import type { ServiceRequestStatus } from "@prisma/client";

const STATUSES: ServiceRequestStatus[] = ["REQUESTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function ServiceRowActions({ id, status }: { id: string; status: ServiceRequestStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      className="h-8 text-xs"
      disabled={pending}
      defaultValue={status}
      onChange={(e) => {
        const next = e.target.value as ServiceRequestStatus;
        start(async () => {
          await updateServiceStatus({ id, status: next });
          router.refresh();
        });
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </Select>
  );
}
