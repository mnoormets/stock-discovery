export type RklbRankFactorKey =
  | 'supported_criteria'
  | 'catalyst_tier'
  | 'growth'
  | 'coverage'
  | 'health';

export interface RklbRankFactors {
  ticker: string;
  supportedCriteriaCount: number;
  catalystTier: number | null;
  growthScore: number | null;
  coverageScore: number;
  healthScore: number | null;
}

export interface RklbRankFactorComparison {
  key: RklbRankFactorKey;
  label: string;
  higherValue: number | null;
  lowerValue: number | null;
  tied: boolean;
}

export interface RklbAdjacentRankExplanation {
  higherTicker: string;
  lowerTicker: string;
  decisiveFactor: RklbRankFactorKey | null;
  researchFactorsTied: boolean;
  consistentWithComparator: boolean;
  summary: string;
  factors: RklbRankFactorComparison[];
}

export const RKLB_RANK_FACTOR_ORDER: ReadonlyArray<{
  key: RklbRankFactorKey;
  label: string;
}> = [
  { key: 'supported_criteria', label: 'Supported criteria' },
  { key: 'catalyst_tier', label: 'Catalyst tier' },
  { key: 'growth', label: 'Fundamental Growth' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'health', label: 'Financial Health' },
];

function comparatorValue(value: number | null): number {
  return value ?? -1;
}

function factorValue(factors: RklbRankFactors, key: RklbRankFactorKey): number | null {
  if (key === 'supported_criteria') return factors.supportedCriteriaCount;
  if (key === 'catalyst_tier') return factors.catalystTier;
  if (key === 'growth') return factors.growthScore;
  if (key === 'coverage') return factors.coverageScore;
  return factors.healthScore;
}

/**
 * Canonical RKLB lexicographic comparator. The ticker is deliberately the last
 * deterministic tie-breaker and is not a research signal.
 */
export function compareRklbRankFactors(a: RklbRankFactors, b: RklbRankFactors): number {
  return b.supportedCriteriaCount - a.supportedCriteriaCount
    || comparatorValue(b.catalystTier) - comparatorValue(a.catalystTier)
    || comparatorValue(b.growthScore) - comparatorValue(a.growthScore)
    || b.coverageScore - a.coverageScore
    || comparatorValue(b.healthScore) - comparatorValue(a.healthScore)
    || a.ticker.localeCompare(b.ticker);
}

function displayValue(value: number | null): string {
  return value == null ? 'unknown' : String(value);
}

/** Explains an already stored adjacent rank without inventing a narrative. */
export function explainAdjacentRklbRanks(
  higher: RklbRankFactors,
  lower: RklbRankFactors,
): RklbAdjacentRankExplanation {
  const factors = RKLB_RANK_FACTOR_ORDER.map(({ key, label }) => {
    const higherValue = factorValue(higher, key);
    const lowerValue = factorValue(lower, key);
    return {
      key,
      label,
      higherValue,
      lowerValue,
      tied: comparatorValue(higherValue) === comparatorValue(lowerValue),
    };
  });
  const decisive = factors.find((factor) => !factor.tied) || null;
  const comparison = compareRklbRankFactors(higher, lower);

  if (!decisive) {
    return {
      higherTicker: higher.ticker,
      lowerTicker: lower.ticker,
      decisiveFactor: null,
      researchFactorsTied: true,
      consistentWithComparator: comparison <= 0,
      summary: `All five research ranking factors tie for ${higher.ticker} and ${lower.ticker}. Ticker is only the deterministic final tie-breaker, not a research advantage.`,
      factors,
    };
  }

  const tiedBefore = factors.slice(0, factors.indexOf(decisive)).map((factor) => factor.label);
  const prefix = tiedBefore.length === 0
    ? 'The first compared factor'
    : `${tiedBefore.join(', ')} ${tiedBefore.length === 1 ? 'ties' : 'tie'}; the first differing factor`;
  const expectedHigher = comparatorValue(decisive.higherValue) > comparatorValue(decisive.lowerValue);
  const summary = expectedHigher
    ? `${higher.ticker} ranks above ${lower.ticker}: ${prefix} is ${decisive.label} (${displayValue(decisive.higherValue)} vs ${displayValue(decisive.lowerValue)}).`
    : `${higher.ticker} is stored above ${lower.ticker}, but the first differing comparator field, ${decisive.label}, is lower (${displayValue(decisive.higherValue)} vs ${displayValue(decisive.lowerValue)}). The stored order does not match the comparator inputs shown here.`;

  return {
    higherTicker: higher.ticker,
    lowerTicker: lower.ticker,
    decisiveFactor: decisive.key,
    researchFactorsTied: false,
    consistentWithComparator: comparison < 0,
    summary,
    factors,
  };
}
