import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClientDashShell } from "./dash-shell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/staff");
  return (
    <ClientDashShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: String(session.user.role),
      }}
    >
      {children}
    </ClientDashShell>
  );
}
