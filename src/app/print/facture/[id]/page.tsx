import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { getInvoiceDoc } from "@/lib/facture-document";
import { getInvoiceShare } from "@/lib/facture-link";
import { InvoiceDocument } from "@/components/factures/invoice-document";
import { InvoiceToolbar } from "@/components/factures/invoice-toolbar";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const doc = session?.user ? await getInvoiceDoc(id) : null;
  const allowed =
    !!doc &&
    (session!.user.role === "STAFF" || session!.user.role === "ADMIN" || doc.ownerUserIds.includes(session!.user.id));
  // Le titre sert de nom de fichier par défaut à l'enregistrement en PDF.
  return { title: { absolute: allowed ? `Facture ${doc.reference} - ${doc.billTo.name}` : "Facture" } };
}

export default async function PrintFacturePage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const doc = await getInvoiceDoc(id);
  if (!doc) notFound();

  const isStaff = session.user.role === "STAFF" || session.user.role === "ADMIN";
  if (!isStaff && !doc.ownerUserIds.includes(session.user.id)) redirect("/dashboard");

  const { publicUrl, whatsappUrl } = getInvoiceShare(doc);
  const qrDataUrl = publicUrl
    ? await QRCode.toDataURL(publicUrl, { margin: 0, width: 240, color: { dark: "#051915", light: "#ffffff" } })
    : null;

  return (
    <div className="afx-inv-page">
      <InvoiceToolbar staff={isStaff} publicUrl={publicUrl} whatsappUrl={whatsappUrl} />
      <InvoiceDocument doc={doc} qrDataUrl={qrDataUrl} />
    </div>
  );
}
