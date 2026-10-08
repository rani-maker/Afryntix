import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getInvoiceDoc } from "@/lib/facture-document";
import { getFacturePublicUrl, verifyFactureSignature } from "@/lib/facture-link";
import { InvoiceDocument } from "@/components/factures/invoice-document";
import { InvoiceToolbar } from "@/components/factures/invoice-toolbar";

// Facture consultable par le client sans compte, via le lien signé envoyé par AFRYNTIX.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  const doc = verifyFactureSignature(id, k) ? await getInvoiceDoc(id) : null;
  return {
    title: { absolute: doc ? `Facture ${doc.reference} - ${doc.billTo.name}` : "Facture AFRYNTIX" },
    robots: { index: false, follow: false },
  };
}

export default async function PublicFacturePage({ params, searchParams }: Props) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!verifyFactureSignature(id, k)) notFound();

  const doc = await getInvoiceDoc(id);
  if (!doc) notFound();

  const publicUrl = getFacturePublicUrl(id);
  const qrDataUrl = publicUrl
    ? await QRCode.toDataURL(publicUrl, { margin: 0, width: 240, color: { dark: "#051915", light: "#ffffff" } })
    : null;

  return (
    <div className="afx-inv-page">
      <InvoiceToolbar />
      <InvoiceDocument doc={doc} qrDataUrl={qrDataUrl} />
    </div>
  );
}
