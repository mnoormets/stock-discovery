import { describe, expect, it } from 'vitest';
import {
  buildDiscoveryQualityAudit,
  discoveryScoreBucket,
  marketCapBucket,
  type DiscoveryQualitySourceItem,
} from '../../src/lib/discovery-quality-audit';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function item(overrides: Partial<DiscoveryQualitySourceItem> = {}): DiscoveryQualitySourceItem {
  return {
    itemId: 1,
    runId: 1,
    symbol: 'AAA',
    observedAt: '2026-08-01T08:00:00.000Z',
    sector: 'Technology',
    marketCap: 1_000_000_000,
    country: null,
    exchange: 'NMS',
    growthScore: 85,
    healthScore: 65,
    coverageScore: 90,
    totalScore: null,
    ...overrides,
  };
}

describe('Discovery Quality Audit V1 calculations', () => {
  it('uses deterministic score and market-cap bucket boundaries', () => {
    expect([0, 19.99, 20, 39.99, 40, 59.99, 60, 79.99, 80, 100].map(discoveryScoreBucket))
      .toEqual(['0-20', '0-20', '20-40', '20-40', '40-60', '40-60', '60-80', '60-80', '80-100', '80-100']);
    expect([49_999_999, 50_000_000, 299_999_999, 300_000_000, 1_999_999_999, 2_000_000_000, 9_999_999_999, 10_000_000_000]
      .map(marketCapBucket)).toEqual(['nano', 'micro', 'micro', 'small', 'small', 'mid', 'mid', 'large']);
  });

  it('calculates item-level sector, market-cap and exchange distributions with honest unknowns', () => {
    const audit = buildDiscoveryQualityAudit([
      item(),
      item({ itemId: 2, symbol: 'BBB', sector: 'Technology', marketCap: 15_000_000_000, exchange: null }),
      item({ itemId: 3, symbol: 'CCC', sector: null, marketCap: null, exchange: 'NYSE' }),
    ], NOW);
    expect(audit.overview).toMatchObject({
      totalItems: 3,
      distinctSymbols: 3,
      knownSectorItems: 2,
      knownMarketCapItems: 2,
      knownExchangeItems: 2,
    });
    expect(audit.distributions.find((entry) => entry.key === 'sector')?.buckets).toEqual([
      { bucket: 'Technology', count: 2, percentage: 66.67 },
      { bucket: 'Unknown', count: 1, percentage: 33.33 },
    ]);
    expect(audit.distributions.find((entry) => entry.key === 'market_cap')?.buckets).toEqual([
      { bucket: 'small', count: 1, percentage: 33.33 },
      { bucket: 'large', count: 1, percentage: 33.33 },
      { bucket: 'Unknown', count: 1, percentage: 33.33 },
    ]);
  });

  it('reports absent country schema as unavailable rather than inventing geography', () => {
    const audit = buildDiscoveryQualityAudit([item()], NOW, false);
    expect(audit.distributions.find((entry) => entry.key === 'country')).toMatchObject({
      available: false,
      knownCount: 0,
      missingCount: 1,
      buckets: [],
    });
    expect(audit.overview.knownCountryItems).toBe(0);
  });

  it('identifies repeated and one-time symbols with deterministic first/last dates', () => {
    const audit = buildDiscoveryQualityAudit([
      item({ itemId: 1, runId: 1, symbol: 'AAA', observedAt: '2026-08-01T08:00:00Z' }),
      item({ itemId: 2, runId: 2, symbol: 'aaa', observedAt: '2026-08-10T08:00:00Z' }),
      item({ itemId: 3, runId: 2, symbol: 'BBB', observedAt: '2026-08-10T08:00:00Z' }),
    ], NOW);
    expect(audit.overview).toMatchObject({ collectionRuns: 2, distinctSymbols: 2, repeatedSymbols: 1, oneTimeSymbols: 1 });
    expect(audit.duplicates[0]).toEqual({
      symbol: 'AAA', appearanceCount: 2,
      firstSeen: '2026-08-01T08:00:00Z', lastSeen: '2026-08-10T08:00:00Z',
    });
    expect(audit.concentration.repeatAppearanceSharePct).toBe(33.33);
  });

  it('builds score distributions from known decision scores and leaves Total Score unavailable', () => {
    const audit = buildDiscoveryQualityAudit([
      item({ growthScore: 85, healthScore: 20, coverageScore: 100 }),
      item({ itemId: 2, symbol: 'BBB', growthScore: 80, healthScore: null, coverageScore: 70 }),
      item({ itemId: 3, symbol: 'CCC', growthScore: null, healthScore: null, coverageScore: null }),
    ], NOW);
    const growth = audit.scores.find((score) => score.key === 'growth')!;
    expect(growth).toMatchObject({ availableCount: 2, missingCount: 1, above80Count: 1, above80Percentage: 50 });
    expect(growth.buckets.find((bucket) => bucket.bucket === '80-100')).toEqual({ bucket: '80-100', count: 2, percentage: 100 });
    expect(audit.scores.find((score) => score.key === 'total')).toMatchObject({ available: false, availableCount: 0, missingCount: 3 });
  });

  it('generates only data-supported highlights and a safe empty state', () => {
    const report = buildDiscoveryQualityAudit([item(), item({ itemId: 2, symbol: 'BBB' })], NOW);
    expect(report.highlights).toContain('Most common sector: Technology (2 items, 100.0%).');
    expect(report.highlights).toContain('2 symbols tie for most frequent at 1 appearance each.');
    const empty = buildDiscoveryQualityAudit([], NOW);
    expect(empty.overview.totalItems).toBe(0);
    expect(empty.duplicates).toEqual([]);
    expect(empty.highlights).toEqual([]);
  });
});
