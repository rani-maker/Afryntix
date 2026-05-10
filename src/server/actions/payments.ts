"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { generateReference, generateWithdrawalCode } from "@/lib/utils";
import { sendWhatsApp, withdrawalCodeTemplate } from "@/lib/whatsapp";
import { notifyInApp, inAppWithdrawalCode, inAppPaymentCompleted } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import type { Currency, BillPaymentType } from "@prisma/client";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const BillPaymentSchema = z
  .object({
    type: z.enum(["INVOICE_PAYMENT", "MONEY_TRANSFER"]),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    clientPhone: z.string().optional(),
    amountSource: z.coerce.number().positive(),
    sourceCurrency: z.enum(["XOF", "RMB", "EUR", "USD"]),
    targetCurrency: z.enum(["XOF", "RMB", "EUR", "USD"]),
    fees: z.coerce.number().nonnegative().default(0),
    recipientName: z.string().min(1),
    recipientPhone: z.string().optional(),
    recipientId: z.string().optional(),
    recipientBank: z.string().optional(),
    recipientAccount: z.string().optional(),
    recipientAddress: z.string().optional(),
    invoiceNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => !!d.clientId || (!!d.clientName && d.clientName.trim().length > 0), {
    message: "Sélectionnez un client enregistré ou saisissez le nom du client.",
    path: ["clientName"],
  });

/**
 * Le client NE PEUT PAS initier — seul un Staff/Admin peut.
 * Génère un code de retrait unique pour les transferts.
 */
export async function createBillPayment(input: unknown): Promise<Result<{ reference: string; withdrawalCode?: string }>> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = BillPaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const data = parsed.data;
  const client = data.clientId
    ? await prisma.user.findUnique({ where: { id: data.clientId } })
    : null;
  if (data.clientId && !client) return { success: false, error: "Client introuvable." };

  // Récupérer le taux du jour
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let rate = 1;
  if (data.sourceCurrency !== data.targetCurrency) {
    const exchangeRate = await prisma.exchangeRate.findUnique({
      where: {
        date_fromCcy_toCcy: {
          date: today,
          fromCcy: data.sourceCurrency,
          toCcy: data.targetCurrency,
        },
      },
    });
    if (!exchangeRate) {
      return {
        success: false,
        error: `Aucun taux de change défini pour aujourd'hui ${data.sourceCurrency} → ${data.targetCurrency}. L'admin doit le définir.`,
      };
    }
    rate = exchangeRate.rate;
  }

  const amountTarget = Math.round((data.amountSource * rate + data.fees) * 100) / 100;

  let withdrawalCode: string | null = null;
  if (data.type === "MONEY_TRANSFER") {
    // Génération unique
    for (let i = 0; i < 5; i++) {
      const candidate = generateWithdrawalCode();
      const exists = await prisma.billPayment.findUnique({ where: { withdrawalCode: candidate } });
      if (!exists) {
        withdrawalCode = candidate;
        break;
      }
    }
    if (!withdrawalCode) return { success: false, error: "Impossible de générer un code de retrait unique." };
  }

  let reference = generateReference("PAY");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.billPayment.findUnique({ where: { reference } });
    if (!exists) break;
    reference = generateReference("PAY");
  }

  await prisma.billPayment.create({
    data: {
      reference,
      type: data.type as BillPaymentType,
      clientId: data.clientId || null,
      clientName: data.clientId ? null : data.clientName,
      clientPhone: data.clientId ? null : data.clientPhone,
      initiatedById: session.user.id,
      amountSource: data.amountSource,
      sourceCurrency: data.sourceCurrency as Currency,
      amountTarget,
      targetCurrency: data.targetCurrency as Currency,
      exchangeRate: rate,
      fees: data.fees,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      recipientId: data.recipientId,
      recipientBank: data.recipientBank,
      recipientAccount: data.recipientAccount,
      recipientAddress: data.recipientAddress,
      invoiceNumber: data.invoiceNumber,
      notes: data.notes,
      withdrawalCode,
      status: withdrawalCode ? "WITHDRAWAL_CODE_SENT" : "PENDING",
    },
  });

  // Notification WhatsApp avec code de retrait
  const notifyTo = client ? client.whatsapp || client.phone : data.clientPhone || null;
  const notifyName = client ? client.name : data.clientName || "Client";
  if (withdrawalCode && notifyTo) {
    await sendWhatsApp({
      to: notifyTo,
      body: withdrawalCodeTemplate({
        clientName: notifyName,
        reference,
        withdrawalCode,
        amount: data.amountSource,
        currency: data.sourceCurrency,
        recipientName: data.recipientName,
      }),
      template: "withdrawal_code",
      userId: client?.id,
    });
  }

  if (client?.id && withdrawalCode) {
    await notifyInApp({
      userId: client.id,
      template: "withdrawal_code",
      ...inAppWithdrawalCode({ reference, withdrawalCode }),
    });
  }

  revalidatePath("/staff/payments");
  revalidatePath("/admin/payments");
  return { success: true, data: { reference, withdrawalCode: withdrawalCode || undefined } };
}

const CompletePaymentSchema = z.object({
  id: z.string().min(1),
  pickupPersonName: z.string().trim().optional(),
  pickupPersonPhone: z.string().trim().optional(),
  pickupPersonId: z.string().trim().optional(),
});

export async function completeBillPayment(input: unknown): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = CompletePaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides." };
  const { id, pickupPersonName, pickupPersonPhone, pickupPersonId } = parsed.data;

  const updated = await prisma.billPayment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: session.user.id,
      pickupPersonName: pickupPersonName || null,
      pickupPersonPhone: pickupPersonPhone || null,
      pickupPersonId: pickupPersonId || null,
    },
  });

  if (updated.clientId) {
    await notifyInApp({
      userId: updated.clientId,
      template: "payment_completed",
      ...inAppPaymentCompleted({ reference: updated.reference }),
    });
  }

  revalidatePath("/staff/payments");
  revalidatePath("/admin/payments");
  return { success: true };
}

export async function cancelBillPayment(input: { id: string; reason?: string }): Promise<Result> {
  await requireRole("STAFF", "ADMIN");
  await prisma.billPayment.update({
    where: { id: input.id },
    data: {
      status: "CANCELLED",
      notes: input.reason,
    },
  });
  revalidatePath("/staff/payments");
  revalidatePath("/admin/payments");
  return { success: true };
}

// ===== TAUX DE CHANGE - ADMIN ONLY =====
const ExchangeRateSchema = z.object({
  fromCcy: z.enum(["XOF", "RMB", "EUR", "USD"]),
  toCcy: z.enum(["XOF", "RMB", "EUR", "USD"]),
  rate: z.coerce.number().positive(),
});

export async function setExchangeRate(input: unknown): Promise<Result> {
  const session = await requireRole("ADMIN"); // SEUL L'ADMIN PEUT
  const parsed = ExchangeRateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides." };
  if (parsed.data.fromCcy === parsed.data.toCcy) {
    return { success: false, error: "Les devises source et cible doivent être différentes." };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.exchangeRate.upsert({
    where: {
      date_fromCcy_toCcy: {
        date: today,
        fromCcy: parsed.data.fromCcy as Currency,
        toCcy: parsed.data.toCcy as Currency,
      },
    },
    update: {
      rate: parsed.data.rate,
      setById: session.user.id,
    },
    create: {
      date: today,
      fromCcy: parsed.data.fromCcy as Currency,
      toCcy: parsed.data.toCcy as Currency,
      rate: parsed.data.rate,
      setById: session.user.id,
    },
  });

  revalidatePath("/admin/exchange-rates");
  revalidatePath("/staff/payments");
  return { success: true };
}

const UpdateExchangeRateSchema = z.object({
  id: z.string().min(1),
  rate: z.coerce.number().positive(),
});

export async function updateExchangeRateById(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = UpdateExchangeRateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides." };

  await prisma.exchangeRate.update({
    where: { id: parsed.data.id },
    data: { rate: parsed.data.rate },
  });

  revalidatePath("/admin/exchange-rates");
  revalidatePath("/staff/payments");
  return { success: true };
}

export async function deleteExchangeRateById(id: string): Promise<Result> {
  await requireRole("ADMIN");
  if (!id) return { success: false, error: "ID manquant." };

  await prisma.exchangeRate.delete({ where: { id } });

  revalidatePath("/admin/exchange-rates");
  revalidatePath("/staff/payments");
  return { success: true };
}
