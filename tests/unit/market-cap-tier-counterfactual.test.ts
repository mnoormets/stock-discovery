import { describe, expect, it, vi } from 'vitest';

import {
  CALIBRATION_MODEL_VERSIONS,
  CALIBRATION_THROUGH_DATE,
  CAPACITY_EXCLUSION_REASON,
  buildCalibration,
  captureCalibration,
  marketCapTier,
  parseArgs,
} from '../../scripts/calibrate-market-cap-tiers.cjs';

function decision(overrides: Record<string, unknown>) {
  return {
    id: 1,
    run_id: 1,
    ticker: 'BASE',
    included: false,
    candidate_rank: null,
    exclusion_reasons: [CAPACITY_EXCLUSION_REASON],
    market_cap: '1000000000',
    growth_score: 70,
    health_score: 60,
    coverage_score: 80,
    catalyst_evidence_tier: 2,
    criteria: [{ status: 'supported' }, { status: 'supported' }],
    ...overrides,
  };
}

describe('market-cap tier historical counterfactual', () => {
  it('uses explicit, non-overlapping market-cap boundaries', () => {
    expect(marketCapTier(null)).toBe('unknown');
    expect(marketCapTier(9_999_999_999)).toBe('below_10b');
    expect(marketCapTier(10_000_000_000)).toBe('10b_to_75b');
    expect(marketCapTier(75_000_000_000)).toBe('10b_to_75b');
    expect(marketCapTier(75_000_000_001)).toBe('above_75b');
  });

  it('selects the exact comparator top three independently in each tier', () => {
    const tickers = ['S1', 'S2', 'S3', 'S4', 'L1', 'L2', 'L3', 'L4'];
    const decisions = tickers.map((ticker, index) => decision({
      id: index + 1,
      ticker,
      market_cap: ticker.startsWith('S') ? '9000000000' : '20000000000',
      growth_score: 100 - index,
      included: ['S1', 'S2', 'L1', 'L2', 'L3'].includes(ticker),
      candidate_rank: ['S1', 'S2', 'L1', 'L2', 'L3'].indexOf(ticker) + 1 || null,
      exclusion_reasons: ['S1', 'S2', 'L1', 'L2', 'L3'].includes(ticker) ? [] : [CAPACITY_EXCLUSION_REASON],
    }));
    const report = buildCalibration([
      { id: 1, decision_date: '2026-08-29', model_version: 'rklb-discovery-v2' },
    ], decisions, []);

    expect(report.runs[0].counterfactual.byTier).toEqual({
      below_10b: ['S1', 'S2', 'S3'],
      '10b_to_75b': ['L1', 'L2', 'L3'],
    });
    expect(report.runs[0].comparison).toEqual({
      overlap: ['S1', 'S2', 'L1', 'L2', 'L3'],
      addedByCounterfactual: ['S3'],
      droppedFromCurrent: [],
    });
  });

  it('does not silently treat other historical exclusions as base eligible', () => {
    const report = buildCalibration([
      { id: 1, decision_date: '2026-08-11', model_version: 'rklb-discovery-v1' },
    ], [
      decision({ ticker: 'CAPACITY', exclusion_reasons: [CAPACITY_EXCLUSION_REASON] }),
      decision({ id: 2, ticker: 'CATALYST', exclusion_reasons: ['Nõutud ajavahemikus ei leitud katalüsaatorit.'] }),
      decision({ id: 3, ticker: 'MULTI', exclusion_reasons: [CAPACITY_EXCLUSION_REASON, 'another reason'] }),
    ], []);

    expect(report.runs[0].eligibleCount).toBe(1);
    expect(report.runs[0].counterfactual.tickers).toEqual(['CAPACITY']);
  });

  it('keeps unknown market cap visible and outside both quotas', () => {
    const report = buildCalibration([
      { id: 1, decision_date: '2026-08-29', model_version: 'rklb-discovery-v2' },
    ], [decision({ ticker: 'UNKNOWN', market_cap: null })], []);

    expect(report.runs[0].unclassifiedEligible).toEqual([
      { ticker: 'UNKNOWN', marketCap: null, derivedTier: 'unknown' },
    ]);
    expect(report.runs[0].counterfactual.tickers).toEqual([]);
  });

  it('reports turnover, repeated occupancy, quota shortfalls, and outcome tracking gaps', () => {
    const runs = [
      { id: 1, decision_date: '2026-08-28', model_version: 'rklb-discovery-v2' },
      { id: 2, decision_date: '2026-08-29', model_version: 'rklb-discovery-v2' },
    ];
    const decisions = [
      decision({ id: 1, run_id: 1, ticker: 'SAME', included: true, candidate_rank: 1, exclusion_reasons: [] }),
      decision({ id: 2, run_id: 1, ticker: 'OLD', market_cap: '20000000000' }),
      decision({ id: 3, run_id: 2, ticker: 'SAME', included: true, candidate_rank: 1, exclusion_reasons: [] }),
      decision({ id: 4, run_id: 2, ticker: 'NEW', market_cap: '20000000000' }),
    ];
    const outcomes = [
      { decision_id: 1, horizon: '1w', status: 'measured', return_percent: '10', excess_return_percent: '5' },
    ];
    const report = buildCalibration(runs, decisions, outcomes);

    expect(report.availability.below_10b).toMatchObject({ runsBelowQuota: 2, runPercent: 100 });
    expect(report.selectionPatterns.counterfactual.below_10b.occupancy[0]).toMatchObject({
      ticker: 'SAME', selectedRuns: 2, longestConsecutiveRuns: 2,
    });
    expect(report.selectionPatterns.counterfactual.below_10b.selectionObservations).toBe(2);
    expect(report.selectionPatterns.counterfactual['10b_to_75b'].turnover).toMatchObject({
      averageEntered: 1, averageExited: 1, averageJaccardPercent: 0,
    });
    expect(report.coverage).toMatchObject({
      counterfactualSelectionObservations: 4,
      counterfactualSelectionsWithStoredOutcomes: 1,
      counterfactualSelectionsWithoutStoredOutcomes: 3,
    });
    expect(report.outcomes.counterfactualTrackedOverlapOnly['1w']).toMatchObject({
      trackedSelections: 1, measured: 1, averageReturnPercent: 10,
    });
    expect(report.outcomes.currentByTier.below_10b['1w'].measured).toBe(1);
    expect(report.outcomes.currentByTier['10b_to_75b']['1w'].trackedSelections).toBe(0);
    expect(report.sustainedFullQuotaEra).toBeNull();
  });

  it('uses a READ ONLY transaction and rolls back without mutation SQL', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push(sql.trim());
        if (/^SELECT\b/i.test(sql.trim())) {
          expect(params).toEqual([CALIBRATION_THROUGH_DATE, CALIBRATION_MODEL_VERSIONS]);
          expect(sql).toContain('decision_date <= $1::date');
          expect(sql).toContain('model_version = ANY($2::text[])');
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    await captureCalibration({ connect: async () => client });
    expect(queries[0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(queries.at(-1)).toBe('ROLLBACK');
    expect(queries.slice(1, -1).every((sql) => /^SELECT\b/i.test(sql))).toBe(true);
    expect(queries.join('\n')).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
  });

  it('accepts only an optional JSON output path', () => {
    expect(parseArgs([])).toEqual({ output: null });
    expect(parseArgs(['--output', 'report.json'])).toEqual({ output: 'report.json' });
    expect(() => parseArgs(['--write-db', 'yes'])).toThrow('Unknown argument');
  });
});
