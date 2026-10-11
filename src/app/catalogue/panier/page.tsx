import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CartClient } from "./cart-client";

export const metadata: Metadata = {
  title: { absolute: "Mon panier | AFRYNTIX" },
  robots: { index: false, follow: false },
};

// Panier des catalogues : public. Un client connecté voit ses coordonnées
// pré-remplies ; sans compte, on demande juste un nom et un numéro WhatsApp.
export default async function CartPage() {
  const session = await auth();
  const role = session?.user?.role;

  let account: { phone: string; city: string } | null = null;
  if (session?.user && role === "CLIENT") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, whatsapp: true, city: true },
    });
    account = { phone: user?.whatsapp ?? user?.phone ?? "", city: user?.city ?? "" };
  }

  return <CartClient account={account} isTeam={!!role && role !== "CLIENT"} />;
}
