"use client";
import { useState } from "react";
import { ArrowLeft, Check, Copy, Download, MessageCircle } from "lucide-react";

const bar: React.CSSProperties = {
  maxWidth: "210mm",
  margin: "0 auto 14px",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#051915",
  color: "#fff",
};
const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 36,
  padding: "0 14px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.22)",
  background: "transparent",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};
const primary: React.CSSProperties = { ...btn, background: "#00e2b1", borderColor: "#00e2b1", color: "#051915" };

export function InvoiceToolbar({
  staff,
  whatsappUrl,
  publicUrl,
}: {
  staff?: boolean;
  whatsappUrl?: string | null;
  publicUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="no-print" style={bar}>
      {staff && (
        <button type="button" style={btn} onClick={() => window.history.back()}>
          <ArrowLeft size={16} /> Retour
        </button>
      )}
      <span style={{ flex: 1, minWidth: 8, fontSize: 12, color: "rgba(255,255,255,.65)" }}>
        Pour un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d&apos;impression.
      </span>
      {staff && publicUrl && (
        <button type="button" style={btn} onClick={copyLink}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Lien copié" : "Copier le lien client"}
        </button>
      )}
      {staff &&
        (whatsappUrl ? (
          <a style={btn} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> Envoyer sur WhatsApp
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>Pas de numéro WhatsApp pour ce client</span>
        ))}
      <button type="button" style={primary} onClick={() => window.print()}>
        <Download size={16} /> Télécharger / Imprimer
      </button>
    </div>
  );
}
