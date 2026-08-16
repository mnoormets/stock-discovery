import { describe, expect, it } from 'vitest';
import {
  buildOutcomeCoverage,
  type OutcomeCoverageSourceRow,
} from '../../src/lib/outcome-coverage';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function row(overrides: Partial<OutcomeCoverageSourceRow> = {}): OutcomeCoverageSourceRow {
  return {
    runId: 1,
    runStartedAt: '2026-08-15T08:00:00.000Z',
    itemId: 1,
    ticker: 'AAA',
    observedAt: '2026-08-15T08:00:00.000Z',
    measured: false,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

describe('Outcome Coverage V1 calculations', () => {
  it('uses all item rows as total and distinct linked measured symbols as headline numerator', () => {
    const report = buildOutcomeCoverage([
      row({ itemId: 1, ticker: 'AAA', measured: true }),
      row({ itemId: 2, ticker: 'aaa', measured: true }),
      row({ itemId: 3, ticker: 'BBB', measured: false }),
      row({ itemId: 4, ticker: 'CCC', measured: true }),
    ], NOW);
    expect(report.summary).toEqual({
      totalCandidates: 4,
      measuredCandidates: 2,
      missingOutcomes: 2,
      coveragePct: 50,
    });
  });

  it('counts measured collection items once per run even when headline symbols repeat', () => {
    const report = buildOutcomeCoverage([
      row({ runId: 1, itemId: 1, ticker: 'AAA', measured: true }),
      row({ runId: 1, itemId: 2, ticker: 'BBB', measured: false }),
      row({ runId: 2, runStartedAt: '2026-08-14T08:00:00Z', itemId: 3, ticker: 'AAA', measured: true }),
    ], NOW);
    expect(report.byRun.find((run) => run.runId === 1)).toMatchObject({
      candidateCount: 2,
      measuredCount: 1,
      missingCount: 1,
      coveragePct: 50,
    });
    expect(report.byRun.find((run) => run.runId === 2)).toMatchObject({
      candidateCount: 1,
      measuredCount: 1,
      missingCount: 0,
      coveragePct: 100,
    });
  });

  it('uses deterministic non-overlapping age boundaries', () => {
    const ages = [30, 31, 90, 91, 180, 181];
    const report = buildOutcomeCoverage(ages.map((days, index) => row({
      itemId: index + 1,
      ticker: `AGE${days}`,
      observedAt: daysAgo(days),
      measured: index % 2 === 0,
    })), NOW);
    expect(report.byAgeBucket).toEqual([
      expect.objectContaining({ bucket: '0-30 days', count: 1, measured: 1, missing: 0 }),
      expect.objectContaining({ bucket: '31-90 days', count: 2, measured: 1, missing: 1 }),
      expect.objectContaining({ bucket: '91-180 days', count: 2, measured: 1, missing: 1 }),
      expect.objectContaining({ bucket: '180+ days', count: 1, measured: 0, missing: 1 }),
    ]);
  });

  it('derives highlights only from calculated coverage rows', () => {
    const report = buildOutcomeCoverage([
      row({ runId: 7, runStartedAt: '2026-07-15T08:00:00Z', itemId: 1, measured: true, observedAt: daysAgo(181) }),
      row({ runId: 7, runStartedAt: '2026-07-15T08:00:00Z', itemId: 2, ticker: 'BBB', measured: false, observedAt: daysAgo(181) }),
    ], NOW);
    expect(report.highlights).toEqual([
      'Coverage currently 50.0%.',
      'Oldest uncovered bucket: 180+ days (1 missing).',
      'Best covered run: 2026-07-15 (50.0%, 1/2).',
    ]);
  });

  it('returns honest empty state values without fabricated percentages', () => {
    const report = buildOutcomeCoverage([], NOW);
    expect(report.summary).toEqual({
      totalCandidates: 0,
      measuredCandidates: 0,
      missingOutcomes: 0,
      coveragePct: null,
    });
    expect(report.byRun).toEqual([]);
    expect(report.byAgeBucket.every((bucket) => bucket.count === 0 && bucket.coveragePct == null)).toBe(true);
    expect(report.highlights).toEqual([]);
  });
});
