import {
  MARKET_CAP_TIER_CANDIDATES_PER_TIER,
  MARKET_CAP_TIER_LOWER_MAX_EXCLUSIVE,
  MARKET_CAP_TIER_UPPER_MIN_INCLUSIVE,
} from './config';

export const MARKET_CAP_TIERS = ['lower_cap', 'middle_cap', 'upper_cap'] as const;
export type MarketCapTier = (typeof MARKET_CAP_TIERS)[number];

export interface MarketCapTierSelection<T> {
  selected: T[];
  selectedByTier: Record<MarketCapTier, T[]>;
  overCapacity: T[];
  unknownMarketCap: T[];
}

export function marketCapTier(marketCap: number | null): MarketCapTier | null {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap < 0) return null;
  if (marketCap < MARKET_CAP_TIER_LOWER_MAX_EXCLUSIVE) return 'lower_cap';
  if (marketCap < MARKET_CAP_TIER_UPPER_MIN_INCLUSIVE) return 'middle_cap';
  return 'upper_cap';
}

export function selectCanonicalCandidatesByMarketCapTier<T>(
  candidates: readonly T[],
  marketCapOf: (candidate: T) => number | null,
  compare: (a: T, b: T) => number,
): MarketCapTierSelection<T> {
  const grouped: Record<MarketCapTier, T[]> = {
    lower_cap: [],
    middle_cap: [],
    upper_cap: [],
  };
  const unknownMarketCap: T[] = [];

  for (const candidate of candidates) {
    const tier = marketCapTier(marketCapOf(candidate));
    if (tier == null) unknownMarketCap.push(candidate);
    else grouped[tier].push(candidate);
  }

  const selectedByTier = {} as Record<MarketCapTier, T[]>;
  const overCapacity: T[] = [];
  for (const tier of MARKET_CAP_TIERS) {
    const ranked = [...grouped[tier]].sort(compare);
    selectedByTier[tier] = ranked.slice(0, MARKET_CAP_TIER_CANDIDATES_PER_TIER);
    overCapacity.push(...ranked.slice(MARKET_CAP_TIER_CANDIDATES_PER_TIER));
  }

  return {
    selected: MARKET_CAP_TIERS.flatMap((tier) => selectedByTier[tier]),
    selectedByTier,
    overCapacity,
    unknownMarketCap,
  };
}
