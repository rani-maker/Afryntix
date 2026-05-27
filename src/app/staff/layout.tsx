import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StaffDashShell } from "./staff-shell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STAFF" && session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <StaffDashShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: String(session.user.role),
      }}
    >
      {children}
    </StaffDashShell>
  );
}
