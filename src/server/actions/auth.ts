"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth, requireRole, signOut } from "@/auth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getAppUrl } from "@/lib/utils";
import { sendEmail, emailPasswordReset } from "@/lib/email";

const PASSWORD_RESET_EXPIRY_MIN = 60;

export async function serverSignOut() {
  const landingUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "/";
  await signOut({ redirectTo: landingUrl });
}

const phoneSchema = z
  .string()
  .min(8)
  .refine((v) => v.startsWith("+"), {
    message: "Le numéro de téléphone doit commencer par l'indicatif du pays (ex : +225).",
  });

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional().or(z.literal("")),
  city: z.string().optional(),
  country: z.string().optional(),
  referralCode: z.string().optional(),
});

type Result<T = void> = { success: true; data?: T } | { success: false; error: string };

export async function registerClient(input: z.infer<typeof RegisterSchema>): Promise<Result> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { success: false, error: "Un compte avec cet email existe déjà." };

  // Vérification optionnelle du code parrain
  let referredByPartnerId: string | null = null;
  if (parsed.data.referralCode && parsed.data.referralCode.trim()) {
    const partner = await prisma.partner.findUnique({
      where: { referralCode: parsed.data.referralCode.trim() },
    });
    if (!partner) return { success: false, error: "Code parrain introuvable." };
    if (partner.status === "TERMINATED") return { success: false, error: "Ce partenaire n'est plus actif." };
    referredByPartnerId = partner.id;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp || parsed.data.phone,
      passwordHash,
      role: "CLIENT",
      city: parsed.data.city,
      country: parsed.data.country,
      referredByPartnerId,
    },
  });
  return { success: true };
}

// Admin invite a Staff (only ADMIN can do this)
export async function inviteStaff(email: string): Promise<Result<{ inviteUrl: string }>> {
  await requireRole("ADMIN");
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return { success: false, error: "Cet email est déjà utilisé." };

  const existingInvite = await prisma.staffInvite.findUnique({ where: { email: normalized } });
  if (existingInvite && existingInvite.expiresAt > new Date()) {
    return { success: false, error: "Une invitation est déjà en cours pour cet email." };
  }
  if (existingInvite) {
    await prisma.staffInvite.delete({ where: { id: existingInvite.id } });
  }

  const token = randomBytes(32).toString("hex");
  await prisma.staffInvite.create({
    data: {
      email: normalized,
      token,
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    },
  });

  const inviteUrl = `${getAppUrl()}/staff-invite/${token}`;
  revalidatePath("/admin/staff");
  return { success: true, data: { inviteUrl } };
}

export async function acceptStaffInvite(input: {
  token: string;
  name: string;
  password: string;
  phone: string;
  whatsapp?: string;
}): Promise<Result> {
  const invite = await prisma.staffInvite.findUnique({ where: { token: input.token } });
  if (!invite) return { success: false, error: "Invitation invalide." };
  if (invite.expiresAt < new Date()) return { success: false, error: "Invitation expirée." };
  if (invite.usedById) return { success: false, error: "Invitation déjà utilisée." };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: invite.email,
      name: input.name,
      passwordHash,
      phone: input.phone,
      whatsapp: input.whatsapp || input.phone,
      role: "STAFF",
    },
  });
  await prisma.staffInvite.update({
    where: { id: invite.id },
    data: { usedById: user.id },
  });
  return { success: true };
}

const ProfileSchema = z.object({
  name: z.string().min(2),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional().or(z.literal("")),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
});

export async function updateProfile(input: z.infer<typeof ProfileSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp || parsed.data.phone,
      city: parsed.data.city || null,
      country: parsed.data.country || null,
      address: parsed.data.address || null,
    },
  });
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function changePassword(input: { current: string; next: string }): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  if (input.next.length < 8) return { success: false, error: "Le nouveau mot de passe doit faire au moins 8 caractères." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) return { success: false, error: "Compte introuvable." };

  const ok = await bcrypt.compare(input.current, user.passwordHash);
  if (!ok) return { success: false, error: "Mot de passe actuel incorrect." };

  const passwordHash = await bcrypt.hash(input.next, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return { success: true };
}

// Lance une demande de réinitialisation de mot de passe. Pour éviter l'énumération
// de comptes, cette action répond toujours success, même si l'email est inconnu.
export async function requestPasswordReset(email: string): Promise<Result> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { success: false, error: "Email invalide." };

  const normalized = parsed.data.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Si l'utilisateur existe ET a un mot de passe (pas un compte OAuth) ET est actif
  if (user && user.passwordHash && user.active) {
    // Invalide les anciens tokens non utilisés de ce user pour éviter l'accumulation
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MIN * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${getAppUrl()}/reset-password/${token}`;
    const tpl = emailPasswordReset({
      recipientName: user.name,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MIN,
    });
    await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      template: "password_reset",
      userId: user.id,
    });
  }

  return { success: true };
}

export async function confirmPasswordReset(input: {
  token: string;
  password: string;
}): Promise<Result> {
  if (!input.token || input.token.length !== 64) {
    return { success: false, error: "Lien de réinitialisation invalide." };
  }
  if (input.password.length < 8) {
    return { success: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: input.token },
    include: { user: true },
  });
  if (!record) return { success: false, error: "Lien de réinitialisation invalide." };
  if (record.usedAt) return { success: false, error: "Ce lien a déjà été utilisé." };
  if (record.expiresAt < new Date()) return { success: false, error: "Ce lien a expiré. Demandez-en un nouveau." };
  if (!record.user.active) return { success: false, error: "Ce compte est désactivé." };

  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return { success: true };
}

export async function deactivateUser(userId: string): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { active: false } });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/clients");
  return { success: true };
}

export async function reactivateUser(userId: string): Promise<Result> {
  await requireRole("ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { active: true } });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/clients");
  return { success: true };
}
