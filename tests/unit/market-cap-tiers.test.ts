import { describe, expect, it } from 'vitest';
import {
  MARKET_CAP_TIER_CANDIDATES_PER_TIER,
  MARKET_CAP_TIER_LOWER_MAX_EXCLUSIVE,
  MARKET_CAP_TIER_POLICY_VERSION,
  MARKET_CAP_TIER_UPPER_MIN_INCLUSIVE,
} from '../../src/lib/config';
import {
  marketCapTier,
  selectCanonicalCandidatesByMarketCapTier,
} from '../../src/lib/market-cap-tiers';

interface Row {
  ticker: string;
  marketCap: number | null;
  rank: number;
}

const compare = (a: Row, b: Row) => a.rank - b.rank || a.ticker.localeCompare(b.ticker);
const select = (rows: Row[]) => selectCanonicalCandidatesByMarketCapTier(rows, (row) => row.marketCap, compare);

describe('market-cap-tier-policy-v1', () => {
  it('exports the approved, versioned policy and quota', () => {
    expect(MARKET_CAP_TIER_POLICY_VERSION).toBe('market-cap-tier-policy-v1');
    expect(MARKET_CAP_TIER_LOWER_MAX_EXCLUSIVE).toBe(1_791_164_000);
    expect(MARKET_CAP_TIER_UPPER_MIN_INCLUSIVE).toBe(48_338_040_832);
    expect(MARKET_CAP_TIER_CANDIDATES_PER_TIER).toBe(2);
  });

  it('classifies both exact percentile boundaries without gaps or overlap', () => {
    expect(marketCapTier(0)).toBe('lower_cap');
    expect(marketCapTier(1_791_163_999)).toBe('lower_cap');
    expect(marketCapTier(1_791_164_000)).toBe('middle_cap');
    expect(marketCapTier(48_338_040_831)).toBe('middle_cap');
    expect(marketCapTier(48_338_040_832)).toBe('upper_cap');
  });

  it('selects at most two independently ranked candidates per tier without borrowing', () => {
    const result = select([
      { ticker: 'L1', marketCap: 100, rank: 1 },
      { ticker: 'M3', marketCap: 3_000_000_000, rank: 3 },
      { ticker: 'M1', marketCap: 3_000_000_000, rank: 1 },
      { ticker: 'M2', marketCap: 3_000_000_000, rank: 2 },
    ]);

    expect(result.selectedByTier.lower_cap.map((row) => row.ticker)).toEqual(['L1']);
    expect(result.selectedByTier.middle_cap.map((row) => row.ticker)).toEqual(['M1', 'M2']);
    expect(result.selectedByTier.upper_cap).toEqual([]);
    expect(result.selected).toHaveLength(3);
    expect(result.overCapacity.map((row) => row.ticker)).toEqual(['M3']);
  });

  it('gives unknown and invalid market caps no tier slot', () => {
    const result = select([
      { ticker: 'NULL', marketCap: null, rank: 1 },
      { ticker: 'NAN', marketCap: Number.NaN, rank: 2 },
      { ticker: 'NEG', marketCap: -1, rank: 3 },
    ]);

    expect(result.selected).toEqual([]);
    expect(result.unknownMarketCap.map((row) => row.ticker)).toEqual(['NULL', 'NAN', 'NEG']);
  });

  it('orders deterministic ties by the supplied final ticker tie-breaker', () => {
    const rows = [
      { ticker: 'BETA', marketCap: 2_000_000_000, rank: 1 },
      { ticker: 'ALPHA', marketCap: 2_000_000_000, rank: 1 },
      { ticker: 'CHARLIE', marketCap: 2_000_000_000, rank: 1 },
    ];

    expect(select(rows).selected.map((row) => row.ticker)).toEqual(['ALPHA', 'BETA']);
    expect(select([...rows].reverse()).selected.map((row) => row.ticker)).toEqual(['ALPHA', 'BETA']);
  });

  it('keeps empty and sparse cohorts sparse instead of forcing six selections', () => {
    expect(select([])).toMatchObject({ selected: [], overCapacity: [], unknownMarketCap: [] });
    expect(select([
      { ticker: 'LOW', marketCap: 1_000_000_000, rank: 1 },
      { ticker: 'UP', marketCap: 100_000_000_000, rank: 1 },
    ]).selected.map((row) => row.ticker)).toEqual(['LOW', 'UP']);
  });
});
