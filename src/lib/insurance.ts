/**
 * Calcul de la prime d'assurance cargo.
 *
 * Règle métier :
 * - Prime = max(minPremium, declaredValue × ratePercent / 100)
 * - Couverture maximale = min(declaredValue, maxCoverage)
 */

export type InsuranceQuote = {
  declaredValue: number;
  ratePercent: number;
  premium: number;
  coverage: number;
};

export function computeInsurance(opts: {
  declaredValue: number;
  ratePercent: number;
  minPremiumXOF: number;
  maxCoverageXOF: number;
}): InsuranceQuote {
  const { declaredValue, ratePercent, minPremiumXOF, maxCoverageXOF } = opts;
  if (declaredValue <= 0) {
    return { declaredValue: 0, ratePercent, premium: 0, coverage: 0 };
  }
  const rawPremium = Math.round(declaredValue * (ratePercent / 100));
  const premium = Math.max(minPremiumXOF, rawPremium);
  const coverage = Math.min(declaredValue, maxCoverageXOF);
  return { declaredValue, ratePercent, premium, coverage };
}
