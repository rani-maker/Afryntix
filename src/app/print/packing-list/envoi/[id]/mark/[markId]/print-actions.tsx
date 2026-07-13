"use client";

export function PrintActions() {
  return (
    <div className="no-print mb-4 flex justify-end gap-2">
      <button
        onClick={() => window.history.back()}
        className="text-xs border px-3 py-1.5 rounded"
      >
        Retour
      </button>
      <button
        onClick={() => window.print()}
        className="text-xs bg-black text-white px-3 py-1.5 rounded"
      >
        Imprimer
      </button>
    </div>
  );
}
