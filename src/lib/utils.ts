import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * URL publique de l'application (utilisée pour les QR codes, liens WhatsApp, invitations staff).
 * En production : définir NEXT_PUBLIC_APP_URL=https://afryntix.com
 */
export function getAppUrl(): string {
  // Côté serveur : préférer APP_URL (non-public, défini au runtime) pour que
  // les liens WhatsApp pointent bien vers la prod et non localhost.
  const url =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function formatXOF(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrency(amount: number, ccy: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: ccy === "RMB" ? "CNY" : ccy,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${ccy}`;
  }
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Génère un numéro de suivi unique au format AFR-{TYPE}-{ANNÉE}-{6 digits}
 * Type: A=Aérien, M=Maritime, V=Véhicule, B=BTP, S=Storage
 */
export function generateTrackingNumber(prefix: "A" | "M" | "V" | "B" | "S"): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `AFR-${prefix}-${year}-${random}`;
}

/**
 * Génère un code de retrait unique pour les paiements (8 caractères alphanumériques)
 */
export function generateWithdrawalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateReference(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `AFR-${prefix}-${year}-${random}`;
}

/**
 * Calcule le poids volumique : (L × l × H en cm) / 6000 pour aérien
 * Source : standard IATA (5000 pour express, 6000 pour standard)
 */
export function calculateVolumetricWeight(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  divisor: number = 6000,
): number {
  return (lengthCm * widthCm * heightCm) / divisor;
}

/**
 * Calcule le volume CBM (mètres cubes)
 */
export function calculateCBM(lengthCm: number, widthCm: number, heightCm: number): number {
  return (lengthCm * widthCm * heightCm) / 1_000_000;
}
