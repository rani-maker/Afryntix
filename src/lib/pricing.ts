import { TransportMode, CargoCategory } from "@prisma/client";
import type { EnvoiStatus, ShipmentStatus } from "@prisma/client";
import { calculateVolumetricWeight, calculateCBM } from "./utils";

/**
 * Grille tarifaire AFRYNTIX (en FCFA)
 * Toutes les tarifications sont configurables côté Admin via PricingRule,
 * mais ces valeurs servent de défaut et de fallback.
 */
export const DEFAULT_PRICING = {
  // ===== AÉRIEN EXPRESS (3-7 jours) =====
  // Uniquement colis ordinaire, téléphone, ordinateur
  AIR_EXPRESS: {
    ORDINARY: { unit: "kg", price: 12000 },
    PHONE: { unit: "pcs", price: 25000 },
    COMPUTER: { unit: "pcs", price: 45000 },
  },
  // ===== AÉRIEN NORMAL =====
  AIR_NORMAL: {
    ORDINARY: { unit: "kg", price: 9000 },
    BATTERY: { unit: "kg", price: 12000 },
    COSMETIC: { unit: "kg", price: 13000 },
    LIQUID: { unit: "kg", price: 13000 },
    POWDER: { unit: "kg", price: 13000 },
    PHONE: { unit: "pcs", price: 25000 },
    COMPUTER: { unit: "pcs", price: 45000 },
  },
  // ===== MARITIME LCL (Groupage) =====
  // 220 000 FCFA/CBM, 210 000 à partir de 5 CBM
  SEA_LCL: {
    ORDINARY: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
    BATTERY: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
    COSMETIC: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
    LIQUID: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
    POWDER: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
    OTHER: { unit: "cbm", price: 220000, priceFrom5CBM: 210000 },
  },
  // ===== MARITIME FCL (Conteneur complet) - sur devis =====
  SEA_FCL: {
    OTHER: { unit: "container", price: 0 }, // sur devis
  },
  // ===== VÉHICULE =====
  VEHICLE: {
    VEHICLE: { unit: "vehicle", price: 1300000 },
  },
  // ===== ENGIN BTP - sur devis =====
  BTP_EQUIPMENT: {
    BTP: { unit: "vehicle", price: 0 }, // sur devis
  },
  // ===== ENTREPOSAGE - sur devis =====
  STORAGE: {
    OTHER: { unit: "cbm", price: 0 },
  },
} as const;

export type PricingResult = {
  unitPrice: number;
  unit: string;
  chargeableQuantity: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  volumetricWeight?: number;
  realWeight?: number;
  cbm?: number;
  notes: string[];
  isQuote: boolean; // true si nécessite un devis manuel
};

export type PricingInput = {
  mode: TransportMode;
  category: CargoCategory;
  pieces?: number;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumeCBM?: number;
  /** Si fourni, override le prix par défaut (Admin custom rule) */
  overrideUnitPrice?: number;
};

/**
 * Validation : certaines catégories sont interdites en Express
 */
export function isExpressEligible(category: CargoCategory): boolean {
  return ["ORDINARY", "PHONE", "COMPUTER"].includes(category);
}

/**
 * Moteur de tarification central.
 * Calcule poids volumique pour aérien (divisor=6000),
 * applique tarif dégressif maritime à partir de 5 CBM,
 * applique acompte 50% / solde 50%.
 */
export function computePrice(input: PricingInput): PricingResult {
  const notes: string[] = [];
  const pieces = input.pieces ?? 1;

  // Validation Express
  if (input.mode === "AIR_EXPRESS" && !isExpressEligible(input.category)) {
    throw new Error(
      "L'envoi Express n'accepte que les colis ordinaires, téléphones et ordinateurs. Les batteries, liquides, cosmétiques et poudres ne sont pas éligibles.",
    );
  }

  let unitPrice = 0;
  let unit = "kg";
  let chargeableQuantity = 0;
  let isQuote = false;

  // ===== AÉRIEN =====
  if (input.mode === "AIR_EXPRESS" || input.mode === "AIR_NORMAL") {
    const grid = DEFAULT_PRICING[input.mode] as Record<string, { unit: string; price: number }>;
    const rule = grid[input.category];

    if (!rule) {
      throw new Error(`Tarif non défini pour ${input.mode} / ${input.category}`);
    }

    unit = rule.unit;
    unitPrice = input.overrideUnitPrice ?? rule.price;

    if (rule.unit === "pcs") {
      // Téléphone / Ordinateur : prix à la pièce
      chargeableQuantity = pieces;
      notes.push(`Tarif à la pièce : ${pieces} pièce(s)`);
    } else {
      // Au poids - calculer poids volumique
      const realWeight = input.weightKg ?? 0;
      let volumetricWeight = 0;

      if (input.lengthCm && input.widthCm && input.heightCm) {
        // Diviseur : 5000 pour Express (IATA), 6000 pour Normal
        const divisor = input.mode === "AIR_EXPRESS" ? 5000 : 6000;
        volumetricWeight = calculateVolumetricWeight(
          input.lengthCm,
          input.widthCm,
          input.heightCm,
          divisor,
        );
        notes.push(
          `Poids volumique : ${volumetricWeight.toFixed(2)} kg (L×l×H/${divisor})`,
        );
      }

      const chargeableWeight = Math.max(realWeight, volumetricWeight);
      chargeableQuantity = chargeableWeight;

      if (volumetricWeight > realWeight) {
        notes.push(
          `Le poids volumique (${volumetricWeight.toFixed(2)} kg) est supérieur au poids réel (${realWeight} kg) - facturation au volumique.`,
        );
      } else {
        notes.push(`Facturation au poids réel : ${realWeight} kg`);
      }

      return finalizePrice({
        unitPrice,
        unit,
        chargeableQuantity,
        notes,
        volumetricWeight,
        realWeight,
        isQuote,
      });
    }
  }

  // ===== MARITIME LCL (Groupage) =====
  else if (input.mode === "SEA_LCL") {
    const grid = DEFAULT_PRICING.SEA_LCL as Record<
      string,
      { unit: string; price: number; priceFrom5CBM: number }
    >;
    const rule = grid[input.category] ?? grid.OTHER;
    unit = "cbm";

    let cbm = input.volumeCBM ?? 0;
    if (!cbm && input.lengthCm && input.widthCm && input.heightCm) {
      cbm = calculateCBM(input.lengthCm, input.widthCm, input.heightCm);
      notes.push(`CBM calculé depuis dimensions : ${cbm.toFixed(3)} m³`);
    }

    chargeableQuantity = cbm;

    if (input.overrideUnitPrice) {
      unitPrice = input.overrideUnitPrice;
    } else if (cbm >= 5) {
      unitPrice = rule.priceFrom5CBM;
      notes.push(`Tarif dégressif appliqué (≥ 5 CBM) : ${unitPrice} FCFA/CBM`);
    } else {
      unitPrice = rule.price;
    }

    return finalizePrice({
      unitPrice,
      unit,
      chargeableQuantity,
      notes,
      cbm,
      isQuote,
    });
  }

  // ===== MARITIME FCL =====
  else if (input.mode === "SEA_FCL") {
    isQuote = true;
    notes.push(
      "Conteneur complet (FCL) : tarification sur devis selon le type de conteneur (20', 40', 40HQ).",
    );
    unit = "container";
    chargeableQuantity = 1;
    unitPrice = input.overrideUnitPrice ?? 0;
  }

  // ===== VÉHICULE =====
  else if (input.mode === "VEHICLE") {
    unit = "vehicle";
    unitPrice = input.overrideUnitPrice ?? DEFAULT_PRICING.VEHICLE.VEHICLE.price;
    chargeableQuantity = pieces;
    notes.push(`Transport véhicule : ${pieces} véhicule(s) × ${unitPrice} FCFA`);
  }

  // ===== ENGIN BTP =====
  else if (input.mode === "BTP_EQUIPMENT") {
    isQuote = true;
    unit = "equipment";
    chargeableQuantity = pieces;
    unitPrice = input.overrideUnitPrice ?? 0;
    notes.push("Engin BTP : tarification sur devis selon type, dimensions et poids.");
  }

  // ===== ENTREPOSAGE =====
  else if (input.mode === "STORAGE") {
    isQuote = true;
    unit = "cbm/jour";
    chargeableQuantity = input.volumeCBM ?? 0;
    unitPrice = input.overrideUnitPrice ?? 0;
    notes.push("Entreposage : tarification sur devis selon volume et durée.");
  }

  return finalizePrice({
    unitPrice,
    unit,
    chargeableQuantity,
    notes,
    isQuote,
  });
}

function finalizePrice(args: {
  unitPrice: number;
  unit: string;
  chargeableQuantity: number;
  notes: string[];
  volumetricWeight?: number;
  realWeight?: number;
  cbm?: number;
  isQuote: boolean;
}): PricingResult {
  const totalAmount = Math.round(args.unitPrice * args.chargeableQuantity);
  const depositAmount = Math.round(totalAmount * 0.5);
  const remainingAmount = totalAmount - depositAmount;

  return {
    unitPrice: args.unitPrice,
    unit: args.unit,
    chargeableQuantity: Number(args.chargeableQuantity.toFixed(3)),
    totalAmount,
    depositAmount,
    remainingAmount,
    volumetricWeight: args.volumetricWeight,
    realWeight: args.realWeight,
    cbm: args.cbm,
    notes: args.notes,
    isQuote: args.isQuote,
  };
}

/**
 * Helper pour le préfixe de tracking number selon le mode
 */
export function trackingPrefix(mode: TransportMode): "A" | "M" | "V" | "B" | "S" {
  switch (mode) {
    case "AIR_EXPRESS":
    case "AIR_NORMAL":
      return "A";
    case "SEA_LCL":
    case "SEA_FCL":
      return "M";
    case "VEHICLE":
      return "V";
    case "BTP_EQUIPMENT":
      return "B";
    case "STORAGE":
      return "S";
  }
}

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  AIR_EXPRESS: "Aérien Express",
  AIR_NORMAL: "Aérien Normal",
  SEA_LCL: "Maritime Groupage (LCL)",
  SEA_FCL: "Maritime Conteneur (FCL)",
  VEHICLE: "Transport Véhicule",
  BTP_EQUIPMENT: "Engin BTP",
  STORAGE: "Entreposage",
};

export const CARGO_CATEGORY_LABELS: Record<CargoCategory, string> = {
  ORDINARY: "Colis Ordinaire",
  BATTERY: "Avec Batterie",
  LIQUID: "Liquide",
  COSMETIC: "Cosmétique",
  POWDER: "Poudre",
  PHONE: "Téléphone",
  COMPUTER: "Ordinateur",
  VEHICLE: "Véhicule",
  BTP: "Engin BTP",
  OTHER: "Autre",
};

export const SHIPMENT_STATUS_LABELS = {
  REGISTERED: "Enregistré",
  RECEIVED_CHINA: "Reçu en Chine",
  IN_TRANSIT: "En Transit",
  ARRIVED_DESTINATION: "Arrivé à Destination",
  CUSTOMS_CLEARANCE: "Dédouanement",
  AVAILABLE_FOR_DELIVERY: "Colis Disponible Pour Livraison",
  DELIVERED: "Livré",
  CANCELLED: "Annulé",
} as const;

export const ENVOI_STATUS_LABELS = {
  PLANNED: "Planifié",
  LOADING: "Chargement",
  DEPARTED: "Parti de Chine",
  IN_TRANSIT: "En Transit",
  ARRIVED: "Arrivé à Destination",
  CLEARED: "Dédouané",
  DELIVERED: "Livré",
  CANCELLED: "Annulé",
} as const;

export const CARRIER_LABELS = {
  MSC: "MSC",
  MAERSK: "Maersk",
  CMA_CGM: "CMA CGM",
  EVERGREEN: "Evergreen",
  COSCO: "COSCO",
  HAPAG_LLOYD: "Hapag-Lloyd",
  ONE: "ONE",
  AIR_FRANCE: "Air France Cargo",
  ETHIOPIAN: "Ethiopian Airlines",
  EMIRATES: "Emirates SkyCargo",
  TURKISH: "Turkish Cargo",
  QATAR: "Qatar Airways Cargo",
  KENYA_AIRWAYS: "Kenya Airways Cargo",
  ROYAL_AIR_MAROC: "Royal Air Maroc Cargo",
  OTHER: "Autre",
} as const;

export const CONTAINER_TYPE_LABELS = {
  TWENTY_GP: "20'GP",
  FORTY_GP: "40'GP",
  FORTY_HQ: "40'HQ",
  FORTY_FIVE: "45'HQ",
  REEFER_20: "20'RF",
  REEFER_40: "40'RF",
  OPEN_TOP: "Open-Top",
  FLAT_RACK: "Flat-Rack",
  OTHER: "Autre",
} as const;

/**
 * Cascade : statut Envoi -> statut à appliquer aux Shipments enfants.
 * Retourne null pour les statuts qui ne doivent rien cascader (ex: PLANNED).
 */
export function envoiStatusToShipmentStatus(s: EnvoiStatus): ShipmentStatus | null {
  switch (s) {
    case "PLANNED":   return null;
    case "LOADING":   return "RECEIVED_CHINA";
    case "DEPARTED":  return "IN_TRANSIT";
    case "IN_TRANSIT":return "IN_TRANSIT";
    case "ARRIVED":   return "ARRIVED_DESTINATION";
    case "CLEARED":   return "CUSTOMS_CLEARANCE";
    case "DELIVERED": return "DELIVERED";
    case "CANCELLED": return "CANCELLED";
  }
}
