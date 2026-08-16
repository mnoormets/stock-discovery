import { describe, expect, it } from 'vitest';
import {
  buildOutcomeAttribution,
  marketCapBucket,
  scoreBucket,
  type OutcomeAttributionObservation,
} from '../../src/lib/outcome-attribution';

const observations: OutcomeAttributionObservation[] = [20, 15, 11, -5, 0, 4].map((returnPct) => ({
  returnPct,
  growthScore: 85,
  healthScore: 72,
  coverageScore: 90,
  marketCap: 1_000_000_000,
  sector: 'Technology',
}));

describe('Outcome Attribution V1 pure aggregation', () => {
  it('uses non-overlapping score buckets at every boundary', () => {
    expect([0, 19.99, 20, 39.99, 40, 59.99, 60, 79.99, 80, 100].map(scoreBucket)).toEqual([
      '0-20', '0-20', '20-40', '20-40', '40-60', '40-60', '60-80', '60-80', '80-100', '80-100',
    ]);
    expect(scoreBucket(null)).toBeNull();
    expect(scoreBucket(101)).toBeNull();
  });

  it('uses deterministic market-cap bands', () => {
    expect([0, 49_999_999, 50_000_000, 299_999_999, 300_000_000,
      1_999_999_999, 2_000_000_000, 9_999_999_999, 10_000_000_000].map(marketCapBucket)).toEqual([
      'nano', 'nano', 'micro', 'micro', 'small', 'small', 'mid', 'mid', 'large',
    ]);
    expect(marketCapBucket(null)).toBeNull();
  });

  it('calculates average, median, >10% wins and <0% losses exactly', () => {
    const report = buildOutcomeAttribution(observations);
    const growth = report.sections.find((section) => section.key === 'growth')!;
    const highGrowth = growth.buckets.find((bucket) => bucket.bucket === '80-100')!;
    expect(highGrowth).toEqual({
      bucket: '80-100',
      sampleCount: 6,
      avgReturnPct: 7.5,
      medianReturnPct: 7.5,
      winRatePct: 50,
      loserRatePct: 16.67,
    });
  });

  it('never invents Total Score attribution', () => {
    const total = buildOutcomeAttribution(observations).sections[0];
    expect(total).toMatchObject({
      key: 'total',
      available: false,
      includedSampleCount: 0,
      missingSignalCount: 6,
      buckets: [],
    });
    expect(total.unavailableReason).toMatch(/do not store a Total Score/i);
  });

  it('excludes buckets below five observations from automatic highlights', () => {
    const report = buildOutcomeAttribution([
      ...observations,
      { ...observations[0], returnPct: 100, growthScore: 10, sector: 'Outlier' },
    ]);
    expect(report.highlights).toHaveLength(3);
    expect(report.highlights.every((highlight) => highlight.sampleCount >= 5)).toBe(true);
    expect(report.highlights.some((highlight) => highlight.bucket === '0-20')).toBe(false);
    expect(report.highlights.some((highlight) => highlight.bucket === 'Outlier')).toBe(false);
  });

  it('handles an empty measured sample without fabricated highlights', () => {
    const report = buildOutcomeAttribution([]);
    expect(report.sampleCount).toBe(0);
    expect(report.highlights).toEqual([]);
    expect(report.sections.find((section) => section.key === 'sector')?.buckets).toEqual([]);
    expect(report.sections.find((section) => section.key === 'growth')?.buckets.every(
      (bucket) => bucket.sampleCount === 0 && bucket.avgReturnPct == null,
    )).toBe(true);
  });
});
