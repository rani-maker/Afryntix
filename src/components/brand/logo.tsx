import Image from "next/image";
import { cn } from "@/lib/utils";

// Logo source (1793 × 852 ≈ 2.105:1)
const LOGO_LIGHT = "/logo.png";
const LOGO_DARK = "/logo-dark.png";
const ASPECT = 2.105;

const VARIANT_HEIGHTS = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

type Variant = keyof typeof VARIANT_HEIGHTS;
type Tone = "light" | "dark" | "auto";

export function Logo({
  variant = "sm",
  tone = "light",
  className,
  priority,
}: {
  variant?: Variant;
  tone?: Tone;
  className?: string;
  priority?: boolean;
}) {
  const h = VARIANT_HEIGHTS[variant];
  const w = Math.round(h * ASPECT);

  if (tone === "auto") {
    return (
      <>
        <Image
          src={LOGO_LIGHT}
          alt="AFRYNTIX"
          width={w}
          height={h}
          priority={priority}
          className={cn(className, "block dark:hidden")}
        />
        <Image
          src={LOGO_DARK}
          alt=""
          aria-hidden
          width={w}
          height={h}
          priority={priority}
          className={cn(className, "hidden dark:block")}
        />
      </>
    );
  }

  return (
    <Image
      src={tone === "dark" ? LOGO_DARK : LOGO_LIGHT}
      alt="AFRYNTIX"
      width={w}
      height={h}
      priority={priority}
      className={className}
    />
  );
}

export function LogoMark({
  size = 36,
  tone = "light",
  className,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
}) {
  const w = Math.round(size * ASPECT);
  if (tone === "auto") {
    return (
      <>
        <Image
          src={LOGO_LIGHT}
          alt="AFRYNTIX"
          width={w}
          height={size}
          className={cn(className, "block dark:hidden")}
        />
        <Image
          src={LOGO_DARK}
          alt=""
          aria-hidden
          width={w}
          height={size}
          className={cn(className, "hidden dark:block")}
        />
      </>
    );
  }
  return (
    <Image
      src={tone === "dark" ? LOGO_DARK : LOGO_LIGHT}
      alt="AFRYNTIX"
      width={w}
      height={size}
      className={className}
    />
  );
}
