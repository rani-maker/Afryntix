"use client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export function LabelToolbar() {
  return (
    <div className="no-print w-full max-w-[420px] flex items-center justify-between">
      <Button onClick={() => window.history.back()} variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Button>
      <Button onClick={() => window.print()} size="sm">
        <Printer className="h-4 w-4" /> Imprimer
      </Button>
      <style>{`
        @media print { .no-print { display: none !important; } }
      `}</style>
    </div>
  );
}
