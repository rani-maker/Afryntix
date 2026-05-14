/**
 * Calcul des frais d'entreposage.
 *
 * Règle métier :
 * - Le free-time démarre quand le colis passe en AVAILABLE_FOR_DELIVERY
 * - Pendant `freeDays` jours, pas de frais
 * - Au-delà, `dailyRateXOF` FCFA par jour entamé et par colis
 * - À la livraison, on "lock" les frais (storageChargedAt + storageFeeAmount)
 */

export type StorageQuote = {
  daysSinceAvailable: number;
  billableDays: number;
  amount: number;
  freeDays: number;
  dailyRate: number;
  withinFreeTime: boolean;
};

export function computeStorageFee(opts: {
  availableSinceAt: Date | null;
  asOf?: Date;
  freeDays: number;
  dailyRateXOF: number;
}): StorageQuote {
  const { availableSinceAt, freeDays, dailyRateXOF } = opts;
  const asOf = opts.asOf ?? new Date();

  if (!availableSinceAt) {
    return {
      daysSinceAvailable: 0,
      billableDays: 0,
      amount: 0,
      freeDays,
      dailyRate: dailyRateXOF,
      withinFreeTime: true,
    };
  }

  const ms = asOf.getTime() - availableSinceAt.getTime();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  const billableDays = Math.max(0, days - freeDays);
  const amount = Math.round(billableDays * dailyRateXOF);

  return {
    daysSinceAvailable: days,
    billableDays,
    amount,
    freeDays,
    dailyRate: dailyRateXOF,
    withinFreeTime: billableDays === 0,
  };
}
