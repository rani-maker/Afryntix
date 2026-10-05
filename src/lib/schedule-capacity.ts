// Logique de capacité des ShippingSchedule.
//
// La capacité d'un départ se mesure dans l'unité naturelle du mode de transport :
//   - Maritime (LCL / FCL) : CBM (m³). Un 40HQ ≈ 68 CBM utiles.
//   - Aérien (Express / Normal) : kg.
//   - Véhicule / BTP / Storage : unités (un véhicule = 1, un engin = 1…).
//
// Côté réservation on dérive ce qu'occupe une demande à partir de ses estimations
// (estimatedVolumeCBM pour le maritime, estimatedWeightKg pour l'aérien).
// Les modes "unitaires" comptent simplement 1 par réservation.

import type { TransportMode, Reservation, Shipment } from "@prisma/client";

export type CapacityUnit = "CBM" | "KG" | "UNIT";

export function getCapacityUnit(mode: TransportMode): CapacityUnit {
  switch (mode) {
    case "SEA_LCL":
    case "SEA_FCL":
    case "STORAGE":
      return "CBM";
    case "AIR_EXPRESS":
    case "AIR_NORMAL":
      return "KG";
    case "VEHICLE":
    case "BTP_EQUIPMENT":
      return "UNIT";
  }
}

export const CAPACITY_UNIT_LABEL: Record<CapacityUnit, string> = {
  CBM: "m³",
  KG: "kg",
  UNIT: "unité",
};

export const CAPACITY_UNIT_LABEL_PLURAL: Record<CapacityUnit, string> = {
  CBM: "m³",
  KG: "kg",
  UNIT: "unités",
};

// Formatte une quantité dans l'unité d'un mode. Garde 2 décimales pour CBM/Kg,
// entiers pour les unités.
export function formatCapacity(value: number, mode: TransportMode): string {
  const unit = getCapacityUnit(mode);
  const formatted = unit === "UNIT" ? Math.round(value).toString() : value.toFixed(2);
  return `${formatted} ${unit === "UNIT" && value > 1 ? CAPACITY_UNIT_LABEL_PLURAL[unit] : CAPACITY_UNIT_LABEL[unit]}`;
}

// Quantité occupée par une réservation pour un mode donné.
// Si l'estimation est absente (null/undefined), on retourne 0 — le client n'a
// pas déclaré la dimension, on ne peut donc pas la décompter automatiquement.
// Le staff peut toujours rejeter / ajuster manuellement.
export function reservationUsage(
  reservation: Pick<Reservation, "estimatedWeightKg" | "estimatedVolumeCBM">,
  mode: TransportMode,
): number {
  const unit = getCapacityUnit(mode);
  if (unit === "CBM") return reservation.estimatedVolumeCBM ?? 0;
  if (unit === "KG") return reservation.estimatedWeightKg ?? 0;
  return 1; // UNIT
}

export function sumReservationUsage(
  reservations: Array<Pick<Reservation, "estimatedWeightKg" | "estimatedVolumeCBM">>,
  mode: TransportMode,
): number {
  return reservations.reduce((acc, r) => acc + reservationUsage(r, mode), 0);
}

// Quantité réellement occupée par un colis déjà créé et rattaché à l'envoi.
// On privilégie la mesure effective (weightKg, volumeCBM, pieces) qui a été
// soit déclarée à la création, soit vérifiée en entrepôt.
export function shipmentUsage(
  shipment: Pick<Shipment, "weightKg" | "volumeCBM" | "pieces">,
  mode: TransportMode,
): number {
  const unit = getCapacityUnit(mode);
  if (unit === "CBM") return shipment.volumeCBM ?? 0;
  if (unit === "KG") return shipment.weightKg ?? 0;
  return shipment.pieces ?? 1; // UNIT
}

export function sumShipmentUsage(
  shipments: Array<Pick<Shipment, "weightKg" | "volumeCBM" | "pieces">>,
  mode: TransportMode,
): number {
  return shipments.reduce((acc, s) => acc + shipmentUsage(s, mode), 0);
}

// Évalue l'occupation d'un calendrier :
//   - Réservations encore en attente (non converties en colis)
//   - PLUS les colis rattachés à l'envoi associé au calendrier
//
// Les colis sont la mesure réelle ; les réservations sont une estimation. Elles
// sont additionnées, mais le code appelant doit s'assurer que les réservations
// déjà converties en colis ne sont pas comptées (filtrer `shipment: null`).
//
// Retourne null si pas de plafond.
export function computeOccupancy(
  capacityValue: number | null | undefined,
  reservations: Array<Pick<Reservation, "estimatedWeightKg" | "estimatedVolumeCBM">>,
  mode: TransportMode,
  shipments: Array<Pick<Shipment, "weightKg" | "volumeCBM" | "pieces">> = [],
): {
  used: number;
  usedReservations: number;
  usedShipments: number;
  capacity: number;
  remaining: number;
  isFull: boolean;
  percent: number;
} | null {
  if (capacityValue == null || capacityValue <= 0) return null;
  const usedReservations = sumReservationUsage(reservations, mode);
  const usedShipments = sumShipmentUsage(shipments, mode);
  const used = usedReservations + usedShipments;
  const remaining = Math.max(0, capacityValue - used);
  return {
    used,
    usedReservations,
    usedShipments,
    capacity: capacityValue,
    remaining,
    isFull: used >= capacityValue,
    percent: Math.min(100, Math.round((used / capacityValue) * 100)),
  };
}
