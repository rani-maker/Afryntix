"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth, requireRole, signOut } from "@/auth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getAppUrl } from "@/lib/utils";

export async function serverSignOut() {
  await signOut({ redirectTo: "/" });
}

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(6),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

type Result<T = void> = { success: true; data?: T } | { success: false; error: string };

export async function registerClient(input: z.infer<typeof RegisterSchema>): Promise<Result> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { success: false, error: "Un compte avec cet email existe déjà." };

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
  phone: z.string().min(6),
  whatsapp: z.string().optional(),
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
