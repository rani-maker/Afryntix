import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminDashShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminDashShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: String(session.user.role),
      }}
    >
      {children}
    </AdminDashShell>
  );
}
