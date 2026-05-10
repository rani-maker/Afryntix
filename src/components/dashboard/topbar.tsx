import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "./sign-out-button";

export function Topbar({
  title,
  subtitle,
  user,
}: {
  title: string;
  subtitle?: string;
  user: { name: string; email: string; role: string };
}) {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-sm hidden sm:block">
          <div className="font-medium leading-none">{user.name}</div>
          <div className="text-muted-foreground text-xs mt-0.5">{user.email}</div>
        </div>
        <Badge variant="default">{user.role}</Badge>
        <SignOutButton />
      </div>
    </header>
  );
}
