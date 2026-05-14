"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { saveBase64File, deleteUploadedFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import type { DocumentType } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const DOCUMENT_TYPES = [
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "MASTER_AIR_WAYBILL",
  "PACKING_LIST",
  "COMMERCIAL_INVOICE",
  "CERTIFICATE_OF_ORIGIN",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "PROOF_OF_DELIVERY",
  "CONTAINER_MANIFEST",
  "PHOTO",
  "OTHER",
] as const;

const UploadSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    label: z.string().max(120).optional(),
    notes: z.string().max(500).optional(),
    fileBase64: z.string().min(10, "Fichier requis"),
    fileName: z.string().max(200).optional(),
    shipmentId: z.string().optional(),
    envoiId: z.string().optional(),
  })
  .refine((d) => !!d.shipmentId || !!d.envoiId, {
    message: "Un shipmentId ou un envoiId est requis",
    path: ["shipmentId"],
  });

export async function uploadDocument(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  if (data.shipmentId) {
    const exists = await prisma.shipment.findUnique({ where: { id: data.shipmentId }, select: { id: true } });
    if (!exists) return { success: false, error: "Colis introuvable." };
  }
  if (data.envoiId) {
    const exists = await prisma.envoi.findUnique({ where: { id: data.envoiId }, select: { id: true } });
    if (!exists) return { success: false, error: "Envoi introuvable." };
  }

  let saved;
  try {
    saved = await saveBase64File({
      base64: data.fileBase64,
      subfolder: "documents",
      originalName: data.fileName,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur d'upload" };
  }

  const doc = await prisma.document.create({
    data: {
      type: data.type as DocumentType,
      label: data.label,
      notes: data.notes,
      fileName: saved.fileName,
      fileUrl: saved.url,
      fileSize: saved.fileSize,
      mimeType: saved.mimeType,
      shipmentId: data.shipmentId || null,
      envoiId: data.envoiId || null,
      uploadedById: session.user.id,
    },
  });

  if (data.shipmentId) {
    revalidatePath(`/staff/shipments/${data.shipmentId}`);
    revalidatePath(`/admin/shipments/${data.shipmentId}`);
  }
  if (data.envoiId) {
    revalidatePath(`/staff/envois/${data.envoiId}`);
    revalidatePath(`/admin/envois/${data.envoiId}`);
  }

  return { success: true, data: { id: doc.id } };
}

export async function deleteDocument(id: string): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { success: false, error: "Document introuvable." };

  await prisma.document.delete({ where: { id } });
  await deleteUploadedFile(doc.fileUrl);

  if (doc.shipmentId) {
    revalidatePath(`/staff/shipments/${doc.shipmentId}`);
    revalidatePath(`/admin/shipments/${doc.shipmentId}`);
  }
  if (doc.envoiId) {
    revalidatePath(`/staff/envois/${doc.envoiId}`);
    revalidatePath(`/admin/envois/${doc.envoiId}`);
  }

  return { success: true };
}

export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  BILL_OF_LADING: "Connaissement (B/L)",
  AIR_WAYBILL: "AWB (House)",
  MASTER_AIR_WAYBILL: "Master AWB",
  PACKING_LIST: "Packing list",
  COMMERCIAL_INVOICE: "Facture commerciale",
  CERTIFICATE_OF_ORIGIN: "Certificat d'origine",
  CUSTOMS_DECLARATION: "Déclaration douanière",
  INSURANCE_CERTIFICATE: "Certificat d'assurance",
  PROOF_OF_DELIVERY: "Preuve de livraison",
  CONTAINER_MANIFEST: "Manifeste container",
  PHOTO: "Photo",
  OTHER: "Autre",
};

export const DOCUMENT_TYPES_FOR_SHIPMENT: (typeof DOCUMENT_TYPES)[number][] = [
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "PACKING_LIST",
  "COMMERCIAL_INVOICE",
  "CERTIFICATE_OF_ORIGIN",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "PROOF_OF_DELIVERY",
  "PHOTO",
  "OTHER",
];

export const DOCUMENT_TYPES_FOR_ENVOI: (typeof DOCUMENT_TYPES)[number][] = [
  "MASTER_AIR_WAYBILL",
  "BILL_OF_LADING",
  "CONTAINER_MANIFEST",
  "CUSTOMS_DECLARATION",
  "INSURANCE_CERTIFICATE",
  "OTHER",
];
