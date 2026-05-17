import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "./lib/prisma";
import { rateLimit, ipFromHeaders } from "./lib/rate-limit";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      phone?: string | null;
    };
  }
  interface User {
    role?: Role;
    phone?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const email = String(creds.email).toLowerCase();

        // Rate-limit anti brute-force : 5 tentatives / 5 min par couple
        // (email, IP) + 20 tentatives / 5 min par IP (anti credential-stuffing
        // qui essaierait beaucoup d'emails depuis la même source).
        //
        // ⚠️ State in-memory : voir lib/rate-limit.ts. En multi-instance,
        // chaque process compte séparément. Suffisant pour gêner un attaquant
        // naïf ; pour du sérieux, brancher Redis.
        try {
          const hdrs = await headers();
          const ip = ipFromHeaders(hdrs);
          const perPair = rateLimit(`login:${email}|${ip}`, 5, 5 * 60_000);
          const perIp = rateLimit(`login:${ip}`, 20, 5 * 60_000);
          if (!perPair.ok || !perIp.ok) {
            // On consomme volontairement un peu de temps pour ne pas trahir
            // le rate-limit via une réponse instantanée distincte d'un
            // bcrypt.compare réel.
            await bcrypt.compare("dummy", "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalid");
            return null;
          }
        } catch {
          // `headers()` peut échouer hors d'un contexte requête (tests). On
          // laisse passer dans ce cas pour ne pas casser le flux.
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.active) return null;
        const valid = await bcrypt.compare(String(creds.password), user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
        session.user.phone = (token.phone as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});

// Helpers serveur
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
