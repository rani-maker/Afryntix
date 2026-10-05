import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { prisma } from "./prisma";
import { sendWhatsApp } from "./whatsapp";
import { verificationCodeTwilioTemplate } from "./whatsapp-templates";
import type { OtpPurpose } from "@prisma/client";

const OTP_LENGTH = 6;
export const OTP_EXPIRY_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 100000-999999, always 6 digits
  return String(randomInt(100000, 1000000));
}

export async function createAndSendOtp(args: {
  userId: string;
  purpose: OtpPurpose;
  recipientName: string;
  phone: string;
}): Promise<{ otpId: string; expiresAt: Date }> {
  // Invalide tout OTP non utilisé du même user/purpose pour éviter d'avoir
  // plusieurs codes valides en parallèle (un seul à la fois).
  await prisma.whatsAppOtp.updateMany({
    where: {
      userId: args.userId,
      purpose: args.purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  const row = await prisma.whatsAppOtp.create({
    data: {
      userId: args.userId,
      codeHash,
      purpose: args.purpose,
      expiresAt,
      phoneSent: args.phone,
    },
  });

  // Envoi WhatsApp — template "verification_code" OBLIGATOIRE (fenêtre 24h fermée
  // pour un nouvel inscrit). Le body freeform ne part que si tu as déjà écrit à
  // ton numéro récemment.
  await sendWhatsApp({
    to: args.phone,
    body: `AFRYNTIX — Bonjour ${args.recipientName}, votre code de vérification est : ${code}. Il expire dans ${OTP_EXPIRY_MIN} minutes.`,
    template: args.purpose === "SIGNUP" ? "signup_otp" : "password_reset_otp",
    userId: args.userId,
    twilioTemplate: verificationCodeTwilioTemplate({
      recipientName: args.recipientName,
      code,
    }),
  });

  return { otpId: row.id, expiresAt };
}

export async function verifyOtp(args: {
  otpId: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  if (!args.otpId || !/^\d{6}$/.test(args.code)) {
    return { ok: false, error: "Code invalide." };
  }

  const row = await prisma.whatsAppOtp.findUnique({ where: { id: args.otpId } });
  if (!row) return { ok: false, error: "Session de vérification introuvable." };
  if (row.purpose !== args.purpose) return { ok: false, error: "Code invalide." };
  if (row.usedAt) return { ok: false, error: "Ce code a déjà été utilisé." };
  if (row.expiresAt < new Date()) {
    return { ok: false, error: "Ce code a expiré. Demandez-en un nouveau." };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Trop de tentatives. Demandez un nouveau code." };
  }

  const match = await bcrypt.compare(args.code, row.codeHash);
  if (!match) {
    await prisma.whatsAppOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = OTP_MAX_ATTEMPTS - row.attempts - 1;
    return {
      ok: false,
      error: remaining > 0 ? `Code incorrect. ${remaining} tentative(s) restante(s).` : "Trop de tentatives. Demandez un nouveau code.",
    };
  }

  await prisma.whatsAppOtp.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return { ok: true, userId: row.userId };
}
