"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TrackingSearchForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/tracking/${value.trim().toUpperCase()}`);
      }}
      className="flex gap-2"
    >
      <Input
        placeholder="Numéro de suivi (ex: AFR-A-2026-123456)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-12 text-base"
        autoComplete="off"
      />
      <Button type="submit" size="lg">
        <Search className="h-4 w-4" />
        Suivre
      </Button>
    </form>
  );
}
