"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, requireRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { generateReference, generateTrackingNumber } from "@/lib/utils";
import { computePrice, trackingPrefix } from "@/lib/pricing";
import { getActivePricingGrid } from "./pricing";
import {
  sendWhatsApp,
  partnerCommissionTemplate,
  partnerPayoutTemplate,
  partnerWelcomeTemplate,
} from "@/lib/whatsapp";
import {
  uploadPartnerDocument,
  getSignedDocumentUrl,
  buildPartnerDocPath,
  deletePartnerDocument,
} from "@/lib/supabase-storage";
import bcrypt from "bcryptjs";
import type {
  PartnerType,
  PartnerStatus,
  CommissionModel,
  PartnerPayoutMethod,
  Currency,
  Prisma,
} from "@prisma/client";

type Result<T = void> = { success: true; data?: T } | { success: false; error: string };

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Génère un code parrain lisible à partir du nom de la société/ville.
 * Ex: "Amidou Diallo" à Bamako -> "BAMAKO-AMIDOU-A3F2"
 */
function generateReferralCode(companyName: string, city: string): string {
  const cleanCity = city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);
  const cleanName = companyName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return [cleanCity || "PRT", cleanName || "AGENT", suffix].filter(Boolean).join("-");
}

async function generateUniqueReferralCode(companyName: string, city: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(companyName, city);
    const existing = await prisma.partner.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  // Fallback : timestamp
  return `PRT-${Date.now().toString(36).toUpperCase()}`;
}

async function generatePartnerCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReference("PRT");
    const existing = await prisma.partner.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `AFR-PRT-${Date.now()}`;
}

// -----------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------

const PartnerTypeEnum = z.enum([
  "APPORTEUR",
  "REVENDEUR",
  "TRANSPORTEUR_RELAIS",
  "AGENT_CHINE",
  "CONFRERE_FORWARDER",
]);

const CommissionModelEnum = z.enum([
  "PERCENT_OF_REVENUE",
  "PERCENT_OF_MARGIN",
  "FIXED_PER_SHIPMENT",
  "FIXED_PER_KG",
  "FIXED_PER_CBM",
  "WHOLESALE_TARIFF",
]);

const StatusEnum = z.enum(["PENDING", "ACTIVE", "SUSPENDED", "TERMINATED"]);

const CreatePartnerSchema = z.object({
  type: PartnerTypeEnum,
  companyName: z.string().min(2, "Nom de société requis (min 2 caractères)"),
  legalForm: z.string().optional(),
  taxId: z.string().optional(),
  contactName: z.string().min(2, "Nom du contact requis"),
  contactPhone: z.string().min(6, "Téléphone requis"),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  country: z.string().min(2, "Pays requis"),
  city: z.string().min(2, "Ville requise"),
  serviceAreas: z.array(z.string()).default([]),
  originSide: z.enum(["CHINA", "AFRICA"]).optional(),
  commissionModel: CommissionModelEnum,
  commissionRate: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;

// -----------------------------------------------------------------
// CRUD
// -----------------------------------------------------------------

export async function createPartner(input: CreatePartnerInput): Promise<Result<{ id: string; code: string; referralCode: string }>> {
  await requireRole("ADMIN");

  const parsed = CreatePartnerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  // Validation économique selon le modèle de commission
  if (
    (d.commissionModel === "PERCENT_OF_REVENUE" || d.commissionModel === "PERCENT_OF_MARGIN") &&
    (d.commissionRate == null || d.commissionRate <= 0 || d.commissionRate > 100)
  ) {
    return { success: false, error: "Le taux de commission doit être entre 0 et 100 (%)." };
  }
  if (
    (d.commissionModel === "FIXED_PER_SHIPMENT" ||
      d.commissionModel === "FIXED_PER_KG" ||
      d.commissionModel === "FIXED_PER_CBM") &&
    (d.commissionRate == null || d.commissionRate <= 0)
  ) {
    return { success: false, error: "Le montant forfaitaire doit être supérieur à 0." };
  }

  const code = await generatePartnerCode();
  const referralCode = await generateUniqueReferralCode(d.companyName, d.city);

  const created = await prisma.partner.create({
    data: {
      code,
      referralCode,
      type: d.type as PartnerType,
      status: "PENDING", // toujours PENDING tant que KYC pas validé
      companyName: d.companyName,
      legalForm: d.legalForm || null,
      taxId: d.taxId || null,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      whatsapp: d.whatsapp || d.contactPhone,
      email: d.email || null,
      country: d.country,
      city: d.city,
      serviceAreas: d.serviceAreas,
      originSide: d.originSide || null,
      commissionModel: d.commissionModel as CommissionModel,
      commissionRate: d.commissionRate ?? null,
      notes: d.notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "PARTNER_CREATED",
      entity: "Partner",
      entityId: created.id,
      metadata: { code: created.code, type: created.type } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/partners");
  return { success: true, data: { id: created.id, code: created.code, referralCode: created.referralCode } };
}

const UpdatePartnerSchema = CreatePartnerSchema.partial().extend({
  id: z.string(),
  status: StatusEnum.optional(),
});

export async function updatePartner(input: z.infer<typeof UpdatePartnerSchema>): Promise<Result> {
  const session = await requireRole("ADMIN");
  const parsed = UpdatePartnerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { id, ...d } = parsed.data;

  // Récupère l'état avant pour détecter une renégociation (modèle ou taux de commission)
  const before = await prisma.partner.findUnique({
    where: { id },
    select: { commissionModel: true, commissionRate: true },
  });
  if (!before) return { success: false, error: "Partenaire introuvable." };

  // Si la commission change, on revalide les contraintes (même règles que createPartner)
  const nextModel = (d.commissionModel ?? before.commissionModel) as CommissionModel;
  const nextRate = d.commissionRate === undefined ? before.commissionRate : d.commissionRate;
  const modelChanged = d.commissionModel != null && d.commissionModel !== before.commissionModel;
  const rateChanged = d.commissionRate !== undefined && d.commissionRate !== before.commissionRate;
  const commissionChanged = modelChanged || rateChanged;

  if (commissionChanged) {
    if (
      (nextModel === "PERCENT_OF_REVENUE" ||
        nextModel === "PERCENT_OF_MARGIN" ||
        nextModel === "WHOLESALE_TARIFF") &&
      (nextRate == null || nextRate <= 0 || nextRate > 100)
    ) {
      return { success: false, error: "Le taux % doit être entre 0 et 100." };
    }
    if (
      (nextModel === "FIXED_PER_SHIPMENT" ||
        nextModel === "FIXED_PER_KG" ||
        nextModel === "FIXED_PER_CBM") &&
      (nextRate == null || nextRate <= 0)
    ) {
      return { success: false, error: "Le montant forfaitaire doit être supérieur à 0." };
    }
  }

  await prisma.partner.update({
    where: { id },
    data: {
      type: d.type as PartnerType | undefined,
      status: d.status as PartnerStatus | undefined,
      companyName: d.companyName,
      legalForm: d.legalForm ?? undefined,
      taxId: d.taxId ?? undefined,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      whatsapp: d.whatsapp ?? undefined,
      email: d.email ?? undefined,
      country: d.country,
      city: d.city,
      serviceAreas: d.serviceAreas ?? undefined,
      originSide: d.originSide ?? undefined,
      commissionModel: d.commissionModel as CommissionModel | undefined,
      commissionRate: d.commissionRate ?? undefined,
      notes: d.notes ?? undefined,
    },
  });

  // Audit : si la commission change, on garde une trace consultable de la renégociation
  if (commissionChanged) {
    await prisma.auditLog.create({
      data: {
        action: "PARTNER_COMMISSION_UPDATED",
        entity: "Partner",
        entityId: id,
        userId: session.user.id,
        metadata: {
          from: {
            model: before.commissionModel,
            rate: before.commissionRate,
          },
          to: {
            model: nextModel,
            rate: nextRate,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${id}`);
  return { success: true };
}

export async function setPartnerStatus(partnerId: string, status: PartnerStatus): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.partner.update({ where: { id: partnerId }, data: { status } });
  await prisma.auditLog.create({
    data: {
      action: `PARTNER_STATUS_${status}`,
      entity: "Partner",
      entityId: partnerId,
    },
  });
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${partnerId}`);
  return { success: true };
}

export async function activatePartner(partnerId: string): Promise<Result> {
  // Active : on vérifie que le KYC minimal est complet (contractSignedAt OU idDocumentUrl)
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };
  if (!partner.idDocumentUrl && !partner.contractUrl) {
    return {
      success: false,
      error: "KYC incomplet : ajoutez au moins une pièce d'identité ou un contrat signé avant activation.",
    };
  }
  return setPartnerStatus(partnerId, "ACTIVE");
}

// -----------------------------------------------------------------
// Ledger & commissions
// -----------------------------------------------------------------

/**
 * Calcule la commission théorique pour un colis selon le modèle du partenaire.
 * Appelée au moment où le shipment passe à FULLY_PAID. Helper interne.
 */
function computeCommission(
  model: CommissionModel,
  rate: number | null | undefined,
  shipment: {
    totalAmount: number;
    chargeableWeight?: number | null;
    volumeCBM?: number | null;
  },
): number {
  if (rate == null) return 0;
  switch (model) {
    case "PERCENT_OF_REVENUE":
      return Math.round((shipment.totalAmount * rate) / 100);
    case "PERCENT_OF_MARGIN":
      // Approximation : on utilise 30% de marge brute par défaut.
      // À affiner quand on aura un vrai coût de revient par colis.
      return Math.round((shipment.totalAmount * 0.3 * rate) / 100);
    case "FIXED_PER_SHIPMENT":
      return Math.round(rate);
    case "FIXED_PER_KG":
      return Math.round((shipment.chargeableWeight ?? 0) * rate);
    case "FIXED_PER_CBM":
      return Math.round((shipment.volumeCBM ?? 0) * rate);
    case "WHOLESALE_TARIFF":
      return 0; // pas de commission auto, géré via tarif gros
  }
}

/**
 * Crédite la commission d'un partenaire pour un shipment soldé.
 * Idempotent : ne crédite qu'une seule fois par shipment (partnerCommissionPaid).
 */
export async function creditPartnerCommission(shipmentId: string): Promise<Result<{ amount: number } | null>> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { referredByPartner: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (!shipment.referredByPartner) return { success: true, data: null };
  if (shipment.partnerCommissionPaid) return { success: true, data: null };
  if (shipment.paymentStatus !== "FULLY_PAID") {
    return { success: false, error: "Le colis doit être entièrement payé." };
  }
  if (shipment.referredByPartner.status !== "ACTIVE") {
    return { success: false, error: "Le partenaire n'est pas actif." };
  }

  const amount = computeCommission(
    shipment.referredByPartner.commissionModel,
    shipment.referredByPartner.commissionRate,
    {
      totalAmount: shipment.totalAmount,
      chargeableWeight: shipment.chargeableWeight,
      volumeCBM: shipment.volumeCBM,
    },
  );

  if (amount <= 0) {
    // Rien à créditer mais on marque comme traité pour éviter de repasser dessus.
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { partnerCommissionPaid: true, partnerCommission: 0 },
    });
    return { success: true, data: { amount: 0 } };
  }

  const [, updatedPartner] = await prisma.$transaction([
    prisma.partnerLedger.create({
      data: {
        partnerId: shipment.referredByPartnerId!,
        shipmentId: shipment.id,
        type: "COMMISSION_EARNED",
        amount,
        currency: shipment.referredByPartner.currency,
        note: `Commission sur ${shipment.trackingNumber}`,
      },
    }),
    prisma.partner.update({
      where: { id: shipment.referredByPartnerId! },
      data: { balance: { increment: amount } },
    }),
    prisma.shipment.update({
      where: { id: shipmentId },
      data: { partnerCommissionPaid: true, partnerCommission: amount },
    }),
  ]);

  // Notification WhatsApp au partenaire (best-effort, ne bloque pas)
  try {
    await sendWhatsApp({
      to: shipment.referredByPartner.whatsapp || shipment.referredByPartner.contactPhone,
      body: partnerCommissionTemplate({
        partnerName: shipment.referredByPartner.contactName,
        trackingNumber: shipment.trackingNumber,
        commissionAmount: amount,
        newBalance: updatedPartner.balance,
      }),
      template: "partner_commission_credited",
      userId: shipment.referredByPartner.userId ?? undefined,
    });
  } catch (err) {
    console.error("[Partner WhatsApp] Erreur notif commission:", err);
  }

  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${shipment.referredByPartnerId}`);
  revalidatePath("/partner");
  return { success: true, data: { amount } };
}

// -----------------------------------------------------------------
// Versements (payouts)
// -----------------------------------------------------------------

const RecordPayoutSchema = z.object({
  partnerId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER", "CASH", "OTHER"]),
  notes: z.string().optional(),
});

export async function recordPartnerPayout(input: z.infer<typeof RecordPayoutSchema>): Promise<Result<{ reference: string }>> {
  await requireRole("ADMIN");
  const session = await auth();
  const parsed = RecordPayoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };
  if (parsed.data.amount > partner.balance) {
    return {
      success: false,
      error: `Le montant (${parsed.data.amount}) dépasse le solde dû (${partner.balance}).`,
    };
  }

  const reference = generateReference("PRTPAY");

  const [payout] = await prisma.$transaction([
    prisma.partnerPayout.create({
      data: {
        reference,
        partnerId: parsed.data.partnerId,
        amount: parsed.data.amount,
        currency: partner.currency,
        method: parsed.data.method as PartnerPayoutMethod,
        status: "PAID",
        paidAt: new Date(),
        notes: parsed.data.notes || null,
        createdById: session?.user?.id,
      },
    }),
    prisma.partnerLedger.create({
      data: {
        partnerId: parsed.data.partnerId,
        type: "PAYOUT",
        amount: -parsed.data.amount,
        currency: partner.currency as Currency,
        note: `Versement ${reference}`,
        createdById: session?.user?.id,
      },
    }),
    prisma.partner.update({
      where: { id: parsed.data.partnerId },
      data: { balance: { decrement: parsed.data.amount } },
    }),
  ]);

  // Lier le ledger au payout
  await prisma.partnerLedger.updateMany({
    where: { partnerId: parsed.data.partnerId, payoutId: null, type: "PAYOUT", note: `Versement ${reference}` },
    data: { payoutId: payout.id },
  });

  // Notification WhatsApp (best-effort)
  try {
    const updated = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
    if (updated) {
      await sendWhatsApp({
        to: updated.whatsapp || updated.contactPhone,
        body: partnerPayoutTemplate({
          partnerName: updated.contactName,
          reference,
          amount: parsed.data.amount,
          method: parsed.data.method.replace("_", " "),
          remainingBalance: updated.balance,
        }),
        template: "partner_payout_done",
        userId: updated.userId ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Partner WhatsApp] Erreur notif payout:", err);
  }

  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  revalidatePath("/partner");
  return { success: true, data: { reference } };
}

// -----------------------------------------------------------------
// Attribution d'un shipment à un partenaire
// -----------------------------------------------------------------

export async function attachShipmentToPartner(shipmentId: string, referralCode: string): Promise<Result> {
  await requireRole("ADMIN", "STAFF");
  const partner = await prisma.partner.findUnique({ where: { referralCode } });
  if (!partner) return { success: false, error: "Code parrain introuvable." };
  if (partner.status !== "ACTIVE") return { success: false, error: "Partenaire non actif." };

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { referredByPartnerId: partner.id },
  });
  revalidatePath("/admin/shipments");
  revalidatePath(`/admin/partners/${partner.id}`);
  return { success: true };
}

// Attache un CLIENT (User) à un partenaire via le code parrain.
// Utilisé à l'inscription : tous les futurs colis de ce client seront auto-attribués.
export async function attachClientToPartnerByCode(userId: string, referralCode: string): Promise<Result> {
  const partner = await prisma.partner.findUnique({ where: { referralCode } });
  if (!partner) return { success: false, error: "Code parrain introuvable." };
  if (partner.status === "TERMINATED") return { success: false, error: "Partenaire résilié." };

  await prisma.user.update({
    where: { id: userId },
    data: { referredByPartnerId: partner.id },
  });
  return { success: true };
}

// -----------------------------------------------------------------
// KYC
// -----------------------------------------------------------------

// --- 1) Mise à jour des champs textuels (numéro CNI + date signature) ---
const KycInfoSchema = z.object({
  partnerId: z.string(),
  idDocumentNumber: z.string().optional(),
  contractSignedAt: z.string().optional(), // ISO date
});

export async function updatePartnerKycInfo(input: z.infer<typeof KycInfoSchema>): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = KycInfoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  await prisma.partner.update({
    where: { id: parsed.data.partnerId },
    data: {
      idDocumentNumber: parsed.data.idDocumentNumber?.trim() || null,
      contractSignedAt: parsed.data.contractSignedAt ? new Date(parsed.data.contractSignedAt) : null,
    },
  });
  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  return { success: true };
}

// --- 2) Upload d'un fichier KYC (pièce d'identité OU contrat signé) ---
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export async function uploadPartnerKycFile(formData: FormData): Promise<Result<{ path: string }>> {
  await requireRole("ADMIN");
  const partnerId = String(formData.get("partnerId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const file = formData.get("file") as File | null;

  if (!partnerId) return { success: false, error: "Partenaire requis." };
  if (kindRaw !== "id-document" && kindRaw !== "contract-signed") {
    return { success: false, error: "Type de document invalide." };
  }
  if (!file || typeof file === "string" || file.size === 0) {
    return { success: false, error: "Aucun fichier sélectionné." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: "Fichier trop volumineux (max 10 Mo)." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { success: false, error: "Format non supporté. Utilisez JPG, PNG, WebP, HEIC ou PDF." };
  }

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };

  const buffer = await file.arrayBuffer();
  const path = buildPartnerDocPath(partnerId, kindRaw, file.name);

  let storedPath: string;
  try {
    storedPath = await uploadPartnerDocument(path, { buffer, contentType: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur d'upload.";
    return { success: false, error: msg };
  }

  // Supprime l'ancien fichier (best-effort)
  const oldPath = kindRaw === "id-document" ? partner.idDocumentUrl : partner.contractUrl;
  if (oldPath && oldPath !== storedPath) {
    try { await deletePartnerDocument(oldPath); } catch { /* ignore */ }
  }

  await prisma.partner.update({
    where: { id: partnerId },
    data: kindRaw === "id-document"
      ? { idDocumentUrl: storedPath }
      : { contractUrl: storedPath, contractSignedAt: partner.contractSignedAt ?? new Date() },
  });

  revalidatePath(`/admin/partners/${partnerId}`);
  return { success: true, data: { path: storedPath } };
}

// --- 3) Génère un lien signé temporaire pour consulter un document ---
export async function getPartnerDocumentSignedUrl(
  partnerId: string,
  kind: "id-document" | "contract-signed",
): Promise<Result<{ url: string }>> {
  await requireRole("ADMIN");
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };

  const path = kind === "id-document" ? partner.idDocumentUrl : partner.contractUrl;
  if (!path) return { success: false, error: "Aucun document téléversé." };

  try {
    const url = await getSignedDocumentUrl(path, 300);
    return { success: true, data: { url } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur." };
  }
}

// --- 4) Suppression d'un document ---
export async function deletePartnerKycFile(
  partnerId: string,
  kind: "id-document" | "contract-signed",
): Promise<Result> {
  await requireRole("ADMIN");
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };

  const path = kind === "id-document" ? partner.idDocumentUrl : partner.contractUrl;
  if (!path) return { success: false, error: "Aucun document à supprimer." };

  try { await deletePartnerDocument(path); } catch { /* ignore */ }

  await prisma.partner.update({
    where: { id: partnerId },
    data: kind === "id-document" ? { idDocumentUrl: null } : { contractUrl: null, contractSignedAt: null },
  });
  revalidatePath(`/admin/partners/${partnerId}`);
  return { success: true };
}

// -----------------------------------------------------------------
// Compte de connexion partenaire (portail /partner)
// -----------------------------------------------------------------

function generateTempPassword(): string {
  // 12 caractères lisibles
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

export async function createPartnerLogin(
  partnerId: string,
  email: string,
): Promise<Result<{ password: string }>> {
  await requireRole("ADMIN");
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };
  if (partner.userId) return { success: false, error: "Ce partenaire a déjà un compte de connexion." };

  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) return { success: false, error: "Email invalide." };

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return { success: false, error: "Cet email est déjà utilisé par un autre compte." };

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalized,
      name: partner.contactName,
      phone: partner.contactPhone,
      whatsapp: partner.whatsapp || partner.contactPhone,
      passwordHash,
      role: "PARTNER",
      city: partner.city,
      country: partner.country,
    },
  });

  await prisma.partner.update({
    where: { id: partnerId },
    data: { userId: user.id, email: normalized },
  });

  // Envoi WhatsApp avec identifiants (best-effort)
  try {
    await sendWhatsApp({
      to: partner.whatsapp || partner.contactPhone,
      body: partnerWelcomeTemplate({
        partnerName: partner.contactName,
        email: normalized,
        password,
        referralCode: partner.referralCode,
      }),
      template: "partner_welcome",
      userId: user.id,
    });
  } catch (err) {
    console.error("[Partner WhatsApp] Erreur welcome:", err);
  }

  revalidatePath(`/admin/partners/${partnerId}`);
  return { success: true, data: { password } };
}

// -----------------------------------------------------------------
// Last-mile : assignation d'un colis à un transporteur partenaire
// -----------------------------------------------------------------

const AssignLastMileSchema = z.object({
  shipmentId: z.string(),
  partnerId: z.string(),
  amount: z.number().positive(),
});

export async function assignLastMilePartner(
  input: z.infer<typeof AssignLastMileSchema>,
): Promise<Result> {
  await requireRole("ADMIN", "STAFF");
  const parsed = AssignLastMileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };
  if (partner.status !== "ACTIVE") return { success: false, error: "Partenaire non actif." };
  if (partner.type !== "TRANSPORTEUR_RELAIS") {
    return { success: false, error: "Ce partenaire n'est pas un transporteur relais." };
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: parsed.data.shipmentId } });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (shipment.lastMileSettled) {
    return { success: false, error: "La livraison de ce colis est déjà soldée — réassignation impossible." };
  }

  await prisma.shipment.update({
    where: { id: parsed.data.shipmentId },
    data: {
      lastMilePartnerId: parsed.data.partnerId,
      lastMileAmount: parsed.data.amount,
      lastMileAssignedAt: new Date(),
    },
  });

  // Notif WhatsApp au transporteur
  try {
    await sendWhatsApp({
      to: partner.whatsapp || partner.contactPhone,
      body: `*AFRYNTIX*\n\nBonjour *${partner.contactName}*,\n\n🚚 Nouvelle livraison assignée :\n📦 ${shipment.trackingNumber}\n💵 Rémunération convenue : ${parsed.data.amount.toLocaleString("fr-FR")} FCFA\n\nVoir le détail : ${process.env.APP_URL || "https://afryntix.com"}/partner/deliveries`,
      template: "partner_last_mile_assigned",
      userId: partner.userId ?? undefined,
    });
  } catch (err) {
    console.error("[Partner WhatsApp] Erreur notif last-mile:", err);
  }

  revalidatePath(`/staff/shipments/${parsed.data.shipmentId}`);
  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  revalidatePath("/partner/deliveries");
  return { success: true };
}

export async function unassignLastMilePartner(shipmentId: string): Promise<Result> {
  await requireRole("ADMIN", "STAFF");
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (shipment.lastMileSettled) {
    return { success: false, error: "Livraison déjà soldée — désassignation impossible." };
  }
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      lastMilePartnerId: null,
      lastMileAmount: null,
      lastMileAssignedAt: null,
    },
  });
  revalidatePath(`/staff/shipments/${shipmentId}`);
  return { success: true };
}

/**
 * Marque la livraison last-mile comme effectuée et crédite la commission.
 * Appelée par le transporteur (via portail) OU par admin/staff.
 * Idempotent via lastMileSettled.
 */
export async function markLastMileDelivered(shipmentId: string): Promise<Result<{ amount: number }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { lastMilePartner: true },
  });
  if (!shipment) return { success: false, error: "Colis introuvable." };
  if (!shipment.lastMilePartner) return { success: false, error: "Aucun transporteur assigné à ce colis." };
  if (shipment.lastMileSettled) return { success: false, error: "Livraison déjà confirmée." };

  // Vérification d'autorisation : ADMIN, STAFF ou le partenaire lui-même
  const isAdminStaff = session.user.role === "ADMIN" || session.user.role === "STAFF";
  const isOwnerPartner =
    session.user.role === "PARTNER" && shipment.lastMilePartner.userId === session.user.id;
  if (!isAdminStaff && !isOwnerPartner) {
    return { success: false, error: "Non autorisé." };
  }

  const amount = shipment.lastMileAmount ?? 0;
  const now = new Date();

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        lastMileSettled: true,
        lastMileDeliveredAt: now,
        status: "DELIVERED",
        history: {
          create: [{
            status: "DELIVERED",
            note: `Livré par partenaire ${shipment.lastMilePartner.companyName}`,
            createdBy: session.user.id,
          }],
        },
      },
    }),
    ...(amount > 0
      ? [
          prisma.partnerLedger.create({
            data: {
              partnerId: shipment.lastMilePartnerId!,
              shipmentId: shipment.id,
              type: "COMMISSION_EARNED",
              amount,
              currency: shipment.lastMilePartner.currency,
              note: `Livraison last-mile ${shipment.trackingNumber}`,
              createdById: session.user.id,
            },
          }),
          prisma.partner.update({
            where: { id: shipment.lastMilePartnerId! },
            data: { balance: { increment: amount } },
          }),
        ]
      : []),
  ]);

  // Notif WhatsApp commission
  if (amount > 0) {
    try {
      const updated = await prisma.partner.findUnique({ where: { id: shipment.lastMilePartnerId! } });
      if (updated) {
        await sendWhatsApp({
          to: updated.whatsapp || updated.contactPhone,
          body: partnerCommissionTemplate({
            partnerName: updated.contactName,
            trackingNumber: shipment.trackingNumber,
            commissionAmount: amount,
            newBalance: updated.balance,
          }),
          template: "partner_last_mile_settled",
          userId: updated.userId ?? undefined,
        });
      }
    } catch (err) {
      console.error("[Partner WhatsApp] Erreur notif last-mile delivered:", err);
    }
  }

  revalidatePath(`/staff/shipments/${shipmentId}`);
  revalidatePath(`/admin/partners/${shipment.lastMilePartnerId}`);
  revalidatePath("/partner/deliveries");
  revalidatePath("/partner");
  return { success: true, data: { amount } };
}

// -----------------------------------------------------------------
// Ajustement manuel du ledger (bonus, correction, remboursement)
// -----------------------------------------------------------------

const LedgerAdjustmentSchema = z.object({
  partnerId: z.string(),
  amount: z.number().refine((v) => v !== 0, { message: "Le montant ne peut pas être 0." }),
  note: z.string().min(3, "Une note explicative est requise."),
});

export async function addLedgerAdjustment(input: z.infer<typeof LedgerAdjustmentSchema>): Promise<Result> {
  const session = await requireRole("ADMIN");
  const parsed = LedgerAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
  if (!partner) return { success: false, error: "Partenaire introuvable." };

  // Si débit, on vérifie que le solde le permet
  if (parsed.data.amount < 0 && Math.abs(parsed.data.amount) > partner.balance) {
    return { success: false, error: "Solde insuffisant pour ce débit." };
  }

  await prisma.$transaction([
    prisma.partnerLedger.create({
      data: {
        partnerId: parsed.data.partnerId,
        type: "ADJUSTMENT",
        amount: parsed.data.amount,
        currency: partner.currency,
        note: parsed.data.note,
        createdById: session.user.id,
      },
    }),
    prisma.partner.update({
      where: { id: parsed.data.partnerId },
      data: { balance: { increment: parsed.data.amount } },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PARTNER_LEDGER_ADJUSTMENT",
      entity: "Partner",
      entityId: parsed.data.partnerId,
      metadata: { amount: parsed.data.amount, note: parsed.data.note } as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  revalidatePath("/partner");
  revalidatePath("/partner/commissions");
  return { success: true };
}

// -----------------------------------------------------------------
// Revendeur : créer une réservation au nom d'un client
// -----------------------------------------------------------------

const RevendeurReservationSchema = z.object({
  mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
  category: z.enum(["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"]),
  supplierTrackingNumber: z.string().min(1, "Numéro fournisseur requis."),
  description: z.string().optional(),
  estimatedWeightKg: z.number().optional(),
  estimatedVolumeCBM: z.number().optional(),
  scheduleId: z.string().optional(),
  recipientName: z.string().min(2, "Nom du destinataire requis."),
  recipientPhone: z.string().min(6, "Téléphone du destinataire requis."),
  recipientAddress: z.string().optional(),
  // Client final (du revendeur) — peut être un compte système OU un free-text
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
});

export async function createReservationByPartner(
  input: z.infer<typeof RevendeurReservationSchema>,
): Promise<Result<{ id: string }>> {
  const session = await requireRole("PARTNER");
  const parsed = RevendeurReservationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) return { success: false, error: "Compte partenaire introuvable." };
  if (partner.status !== "ACTIVE") return { success: false, error: "Votre compte partenaire n'est pas actif." };
  if (partner.type !== "REVENDEUR") {
    return { success: false, error: "Seuls les revendeurs peuvent saisir des commandes." };
  }

  // Résoudre le client : compte existant via email, sinon créer un User minimal ou attacher en free-text
  let clientId: string | null = null;
  if (parsed.data.clientEmail) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.clientEmail.toLowerCase() } });
    if (existing) {
      clientId = existing.id;
    }
  }

  // Si pas de client résolu, on crée un User CLIENT minimal (pas de mdp — le revendeur opère pour lui)
  if (!clientId && parsed.data.clientName && parsed.data.clientPhone) {
    const email = parsed.data.clientEmail?.toLowerCase() || `revendeur-${Date.now()}@afryntix.local`;
    const created = await prisma.user.create({
      data: {
        email,
        name: parsed.data.clientName,
        phone: parsed.data.clientPhone,
        whatsapp: parsed.data.clientPhone,
        role: "CLIENT",
        referredByPartnerId: partner.id,
      },
    });
    clientId = created.id;
  }

  if (!clientId) {
    return { success: false, error: "Précisez au moins le nom et le téléphone du client." };
  }

  const reservation = await prisma.reservation.create({
    data: {
      clientId,
      mode: parsed.data.mode,
      category: parsed.data.category,
      supplierTrackingNumber: parsed.data.supplierTrackingNumber,
      description: parsed.data.description,
      estimatedWeightKg: parsed.data.estimatedWeightKg,
      estimatedVolumeCBM: parsed.data.estimatedVolumeCBM,
      scheduleId: parsed.data.scheduleId || null,
      recipientName: parsed.data.recipientName,
      recipientPhone: parsed.data.recipientPhone,
      recipientAddress: parsed.data.recipientAddress,
      createdByPartnerId: partner.id,
      status: "PENDING",
    },
  });

  revalidatePath("/partner/orders");
  revalidatePath("/staff/reservations");
  revalidatePath("/admin/reservations");
  return { success: true, data: { id: reservation.id } };
}

// -----------------------------------------------------------------
// Auto-séparée : reset password (existant)
// -----------------------------------------------------------------

export async function resetPartnerPassword(partnerId: string): Promise<Result<{ password: string }>> {
  await requireRole("ADMIN");
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { user: true },
  });
  if (!partner || !partner.user) {
    return { success: false, error: "Ce partenaire n'a pas de compte de connexion." };
  }

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: partner.user.id },
    data: { passwordHash },
  });

  // Notification WhatsApp
  try {
    await sendWhatsApp({
      to: partner.whatsapp || partner.contactPhone,
      body: partnerWelcomeTemplate({
        partnerName: partner.contactName,
        email: partner.user.email,
        password,
        referralCode: partner.referralCode,
      }),
      template: "partner_password_reset",
      userId: partner.user.id,
    });
  } catch (err) {
    console.error("[Partner WhatsApp] Erreur reset mdp:", err);
  }

  revalidatePath(`/admin/partners/${partnerId}`);
  return { success: true, data: { password } };
}

// =================================================================
// AGENT_CHINE — Réception physique + QC + création du Shipment
// =================================================================

export async function getAgentReceptionQueue(): Promise<Result<{
  reservations: Array<{
    id: string;
    supplierTrackingNumber: string | null;
    mode: string;
    category: string;
    description: string | null;
    estimatedWeightKg: number | null;
    estimatedVolumeCBM: number | null;
    recipientName: string | null;
    clientName: string;
    clientPhone: string | null;
    createdAt: Date;
  }>;
}>> {
  const session = await requireRole("PARTNER");
  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) return { success: false, error: "Compte partenaire introuvable." };
  if (partner.type !== "AGENT_CHINE") return { success: false, error: "Réservé aux agents Chine." };
  if (partner.status !== "ACTIVE") return { success: false, error: "Compte non actif." };

  const reservations = await prisma.reservation.findMany({
    where: { status: "VALIDATED" },
    orderBy: { validatedAt: "desc" },
    take: 100,
    include: { client: { select: { name: true, phone: true } } },
  });

  return {
    success: true,
    data: {
      reservations: reservations.map((r) => ({
        id: r.id,
        supplierTrackingNumber: r.supplierTrackingNumber,
        mode: r.mode,
        category: r.category,
        description: r.description,
        estimatedWeightKg: r.estimatedWeightKg,
        estimatedVolumeCBM: r.estimatedVolumeCBM,
        recipientName: r.recipientName,
        clientName: r.client.name,
        clientPhone: r.client.phone,
        createdAt: r.createdAt,
      })),
    },
  };
}

const ReceiveReservationSchema = z.object({
  reservationId: z.string(),
  pieces: z.coerce.number().int().min(1),
  weightKg: z.coerce.number().positive(),
  lengthCm: z.coerce.number().nonnegative().optional(),
  widthCm: z.coerce.number().nonnegative().optional(),
  heightCm: z.coerce.number().nonnegative().optional(),
  volumeCBM: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  photosBase64: z.array(z.string()).max(8).optional(),
});

export async function receiveReservationAsAgent(
  input: z.infer<typeof ReceiveReservationSchema>,
): Promise<Result<{ trackingNumber: string; shipmentId: string }>> {
  const session = await requireRole("PARTNER");
  const parsed = ReceiveReservationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) return { success: false, error: "Compte partenaire introuvable." };
  if (partner.type !== "AGENT_CHINE") return { success: false, error: "Réservé aux agents Chine." };
  if (partner.status !== "ACTIVE") return { success: false, error: "Compte non actif." };

  const reservation = await prisma.reservation.findUnique({
    where: { id: parsed.data.reservationId },
    include: { client: true, shipment: true },
  });
  if (!reservation) return { success: false, error: "Réservation introuvable." };
  if (reservation.status !== "VALIDATED") {
    return { success: false, error: "Cette réservation n'est pas dans l'état attendu (VALIDATED requise)." };
  }
  if (reservation.shipment) return { success: false, error: "Déjà réceptionnée." };

  // Tarification basée sur les MESURES RÉELLES
  let pricing;
  try {
    const pricingGrid = await getActivePricingGrid();
    pricing = computePrice({
      mode: reservation.mode,
      category: reservation.category,
      pieces: parsed.data.pieces,
      weightKg: parsed.data.weightKg,
      lengthCm: parsed.data.lengthCm,
      widthCm: parsed.data.widthCm,
      heightCm: parsed.data.heightCm,
      volumeCBM: parsed.data.volumeCBM,
      pricingGrid,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur de calcul." };
  }

  let trackingNumber = generateTrackingNumber(trackingPrefix(reservation.mode));
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!exists) break;
    trackingNumber = generateTrackingNumber(trackingPrefix(reservation.mode));
  }

  const chargeableWeight = pricing.unit === "kg" ? pricing.chargeableQuantity : undefined;

  // Auto-attribution partenaire apporteur (du client)
  let referredByPartnerId: string | null = null;
  if (reservation.client.referredByPartnerId) {
    const refPartner = await prisma.partner.findUnique({
      where: { id: reservation.client.referredByPartnerId },
      select: { status: true },
    });
    if (refPartner && refPartner.status === "ACTIVE") {
      referredByPartnerId = reservation.client.referredByPartnerId;
    }
  }

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      clientId: reservation.clientId,
      reservationId: reservation.id,
      referredByPartnerId,
      mode: reservation.mode,
      category: reservation.category,
      description: parsed.data.description ?? reservation.description,
      pieces: parsed.data.pieces,
      weightKg: parsed.data.weightKg,
      declaredWeightKg: reservation.estimatedWeightKg,
      verifiedWeightKg: parsed.data.weightKg,
      weightVerifiedAt: new Date(),
      weightVerifiedById: session.user.id,
      lengthCm: parsed.data.lengthCm,
      widthCm: parsed.data.widthCm,
      heightCm: parsed.data.heightCm,
      volumeCBM: parsed.data.volumeCBM ?? pricing.cbm,
      volumetricWeight: pricing.volumetricWeight,
      chargeableWeight,
      recipientName: reservation.recipientName,
      recipientPhone: reservation.recipientPhone,
      recipientAddress: reservation.recipientAddress,
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      depositAmount: pricing.depositAmount,
      remainingAmount: pricing.remainingAmount,
      status: "RECEIVED_CHINA",
      history: {
        create: [
          { status: "REGISTERED", note: "Réservation convertie en colis" },
          { status: "RECEIVED_CHINA", note: `Reçu et pesé par agent ${partner.companyName}`, createdBy: session.user.id },
        ],
      },
    },
  });

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: "RECEIVED" },
  });

  // Photos QC (best-effort)
  if (parsed.data.photosBase64 && parsed.data.photosBase64.length > 0) {
    for (const dataUrl of parsed.data.photosBase64) {
      try {
        await prisma.shipmentPhoto.create({
          data: { shipmentId: shipment.id, url: dataUrl, caption: `QC par ${partner.companyName}` },
        });
      } catch (err) {
        console.error("[Agent] Erreur photo QC:", err);
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "AGENT_RECEIVED_RESERVATION",
      entity: "Shipment",
      entityId: shipment.id,
      metadata: {
        partnerId: partner.id,
        reservationId: reservation.id,
        declaredWeight: reservation.estimatedWeightKg,
        verifiedWeight: parsed.data.weightKg,
      } as Prisma.InputJsonValue,
    },
  });

  // Crédit commission agent (FIXED_PER_SHIPMENT / FIXED_PER_KG / FIXED_PER_CBM)
  if (
    partner.commissionRate &&
    partner.commissionRate > 0 &&
    (partner.commissionModel === "FIXED_PER_SHIPMENT" ||
      partner.commissionModel === "FIXED_PER_KG" ||
      partner.commissionModel === "FIXED_PER_CBM")
  ) {
    let amount = 0;
    if (partner.commissionModel === "FIXED_PER_SHIPMENT") amount = Math.round(partner.commissionRate);
    else if (partner.commissionModel === "FIXED_PER_KG")
      amount = Math.round((parsed.data.weightKg ?? 0) * partner.commissionRate);
    else if (partner.commissionModel === "FIXED_PER_CBM")
      amount = Math.round((parsed.data.volumeCBM ?? pricing.cbm ?? 0) * partner.commissionRate);

    if (amount > 0) {
      try {
        await prisma.$transaction([
          prisma.partnerLedger.create({
            data: {
              partnerId: partner.id,
              shipmentId: shipment.id,
              type: "COMMISSION_EARNED",
              amount,
              currency: partner.currency,
              note: `Réception ${trackingNumber}`,
              createdById: session.user.id,
            },
          }),
          prisma.partner.update({
            where: { id: partner.id },
            data: { balance: { increment: amount } },
          }),
        ]);
        const updated = await prisma.partner.findUnique({ where: { id: partner.id } });
        if (updated) {
          try {
            await sendWhatsApp({
              to: updated.whatsapp || updated.contactPhone,
              body: partnerCommissionTemplate({
                partnerName: updated.contactName,
                trackingNumber,
                commissionAmount: amount,
                newBalance: updated.balance,
              }),
              template: "partner_reception_commission",
              userId: updated.userId ?? undefined,
            });
          } catch { /* best-effort */ }
        }
      } catch (err) {
        console.error("[Agent] Erreur crédit commission:", err);
      }
    }
  }

  revalidatePath("/partner/warehouse");
  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");
  revalidatePath(`/admin/partners/${partner.id}`);
  return { success: true, data: { trackingNumber, shipmentId: shipment.id } };
}

// =================================================================
// CONFRERE_FORWARDER — Création de colis au tarif gros
// =================================================================

const ForwarderShipmentSchema = z.object({
  mode: z.enum(["AIR_EXPRESS", "AIR_NORMAL", "SEA_LCL", "SEA_FCL", "VEHICLE", "BTP_EQUIPMENT", "STORAGE"]),
  category: z.enum(["ORDINARY", "BATTERY", "LIQUID", "COSMETIC", "POWDER", "PHONE", "COMPUTER", "VEHICLE", "BTP", "OTHER"]),
  description: z.string().optional(),
  supplierTrackingNumber: z.string().optional(),
  pieces: z.coerce.number().int().min(1).default(1),
  weightKg: z.coerce.number().nonnegative().optional(),
  lengthCm: z.coerce.number().nonnegative().optional(),
  widthCm: z.coerce.number().nonnegative().optional(),
  heightCm: z.coerce.number().nonnegative().optional(),
  volumeCBM: z.coerce.number().nonnegative().optional(),
  destinationCity: z.string().min(1, "Destination requise"),
  destinationCountry: z.string().optional(),
  recipientName: z.string().min(2, "Nom destinataire requis"),
  recipientPhone: z.string().min(6, "Téléphone destinataire requis"),
  recipientAddress: z.string().optional(),
});

export async function createForwarderShipment(
  input: z.infer<typeof ForwarderShipmentSchema>,
): Promise<Result<{ trackingNumber: string; shipmentId: string; wholesaleTotal: number; publicTotal: number }>> {
  const session = await requireRole("PARTNER");
  const parsed = ForwarderShipmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) return { success: false, error: "Compte partenaire introuvable." };
  if (partner.type !== "CONFRERE_FORWARDER") {
    return { success: false, error: "Réservé aux confrères forwarders." };
  }
  if (partner.status !== "ACTIVE") return { success: false, error: "Compte non actif." };
  if (!partner.userId) return { success: false, error: "Pas de compte utilisateur lié." };

  let pricing;
  try {
    const pricingGrid = await getActivePricingGrid();
    pricing = computePrice({
      mode: parsed.data.mode,
      category: parsed.data.category,
      pieces: parsed.data.pieces,
      weightKg: parsed.data.weightKg,
      lengthCm: parsed.data.lengthCm,
      widthCm: parsed.data.widthCm,
      heightCm: parsed.data.heightCm,
      volumeCBM: parsed.data.volumeCBM,
      pricingGrid,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur de calcul." };
  }

  const discountPercent =
    partner.commissionModel === "WHOLESALE_TARIFF" && partner.commissionRate
      ? Math.min(Math.max(partner.commissionRate, 0), 100)
      : 0;
  const discountFactor = 1 - discountPercent / 100;

  const wholesaleUnitPrice = pricing.unitPrice ? Math.round(pricing.unitPrice * discountFactor) : null;
  const wholesaleTotal = Math.round(pricing.totalAmount * discountFactor);
  const wholesaleDeposit = Math.round(pricing.depositAmount * discountFactor);
  const wholesaleRemaining = wholesaleTotal - wholesaleDeposit;

  let trackingNumber = generateTrackingNumber(trackingPrefix(parsed.data.mode));
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!exists) break;
    trackingNumber = generateTrackingNumber(trackingPrefix(parsed.data.mode));
  }

  const chargeableWeight = pricing.unit === "kg" ? pricing.chargeableQuantity : undefined;

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      clientId: partner.userId,
      referredByPartnerId: partner.id,
      mode: parsed.data.mode,
      category: parsed.data.category,
      description: parsed.data.description,
      pieces: parsed.data.pieces,
      weightKg: parsed.data.weightKg,
      declaredWeightKg: parsed.data.weightKg,
      lengthCm: parsed.data.lengthCm,
      widthCm: parsed.data.widthCm,
      heightCm: parsed.data.heightCm,
      volumeCBM: parsed.data.volumeCBM ?? pricing.cbm,
      volumetricWeight: pricing.volumetricWeight,
      chargeableWeight,
      destinationCity: parsed.data.destinationCity,
      destinationCountry: parsed.data.destinationCountry,
      recipientName: parsed.data.recipientName,
      recipientPhone: parsed.data.recipientPhone,
      recipientAddress: parsed.data.recipientAddress,
      unitPrice: wholesaleUnitPrice,
      totalAmount: wholesaleTotal,
      depositAmount: wholesaleDeposit,
      remainingAmount: wholesaleRemaining,
      partnerCommission: 0,
      partnerCommissionPaid: true,
      history: {
        create: [
          {
            status: "REGISTERED",
            note: `Saisie confrère ${partner.companyName} — tarif gros ${discountPercent}% de remise`,
            createdBy: session.user.id,
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "FORWARDER_CREATED_SHIPMENT",
      entity: "Shipment",
      entityId: shipment.id,
      metadata: {
        partnerId: partner.id,
        discountPercent,
        publicTotal: pricing.totalAmount,
        wholesaleTotal,
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/partner/wholesale");
  revalidatePath("/staff/shipments");
  revalidatePath("/admin/shipments");

  return {
    success: true,
    data: {
      trackingNumber,
      shipmentId: shipment.id,
      wholesaleTotal,
      publicTotal: pricing.totalAmount,
    },
  };
}

export async function bulkCreateForwarderShipments(
  inputs: z.infer<typeof ForwarderShipmentSchema>[],
): Promise<Result<{ created: number; failed: number; trackingNumbers: string[] }>> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { success: false, error: "Aucun colis à créer." };
  }
  if (inputs.length > 50) {
    return { success: false, error: "Maximum 50 colis par lot." };
  }

  let created = 0;
  let failed = 0;
  const trackingNumbers: string[] = [];

  for (const input of inputs) {
    const res = await createForwarderShipment(input);
    if (res.success && res.data) {
      created++;
      trackingNumbers.push(res.data.trackingNumber);
    } else {
      failed++;
    }
  }

  return { success: true, data: { created, failed, trackingNumbers } };
}

export async function previewForwarderPricing(input: {
  mode: string;
  category: string;
  pieces?: number;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumeCBM?: number;
}): Promise<Result<{
  publicTotal: number;
  wholesaleTotal: number;
  discountPercent: number;
  unit: string;
  chargeableQuantity: number;
}>> {
  const session = await requireRole("PARTNER");
  const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } });
  if (!partner) return { success: false, error: "Compte partenaire introuvable." };
  if (partner.type !== "CONFRERE_FORWARDER") {
    return { success: false, error: "Réservé aux confrères forwarders." };
  }

  try {
    const pricingGrid = await getActivePricingGrid();
    const pricing = computePrice({
      mode: input.mode as Parameters<typeof computePrice>[0]["mode"],
      category: input.category as Parameters<typeof computePrice>[0]["category"],
      pieces: input.pieces ?? 1,
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      volumeCBM: input.volumeCBM,
      pricingGrid,
    });
    const discountPercent =
      partner.commissionModel === "WHOLESALE_TARIFF" && partner.commissionRate
        ? Math.min(Math.max(partner.commissionRate, 0), 100)
        : 0;
    return {
      success: true,
      data: {
        publicTotal: pricing.totalAmount,
        wholesaleTotal: Math.round(pricing.totalAmount * (1 - discountPercent / 100)),
        discountPercent,
        unit: pricing.unit,
        chargeableQuantity: pricing.chargeableQuantity,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur de calcul." };
  }
}

