import { cn } from "@/lib/utils";

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
        "text-[hsl(var(--dash-accent))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
