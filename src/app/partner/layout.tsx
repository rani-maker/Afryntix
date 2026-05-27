import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PartnerDashShell, type PartnerType } from "./partner-shell";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/staff");
  if (session.user.role === "CLIENT") redirect("/dashboard");
  if (session.user.role !== "PARTNER") redirect("/login");

  // Récupère le type de partenaire pour adapter le menu
  const partner = await prisma.partner.findFirst({
    where: { userId: session.user.id },
    select: { type: true, status: true, companyName: true },
  });

  return (
    <PartnerDashShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: String(session.user.role),
      }}
      partnerType={(partner?.type as PartnerType) ?? null}
      companyName={partner?.companyName ?? null}
    >
      {children}
    </PartnerDashShell>
  );
}
