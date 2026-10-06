import { describe, expect, it } from 'vitest';
import {
  assessPaperExecutionQuote,
  derivePaperBusinessState,
  derivePaperMarketSetupState,
  evaluatePaperStrategies,
  paperCommissionUsd,
  shouldFailIncompletePaperExecution,
  type PaperSignalInput,
} from '../../src/lib/paper-strategy';
import type { CandidatePriceContext } from '../../src/lib/price-context';

function priceContext(overrides: Partial<CandidatePriceContext> = {}): CandidatePriceContext {
  return {
    version: 'price-context-v1',
    asOf: '2026-08-31T12:00:00.000Z',
    currentPrice: 100,
    oneMonthReturnPercent: 5,
    threeMonthReturnPercent: 10,
    sixMonthReturnPercent: 15,
    distanceFrom52WeekHighPercent: -10,
    distanceFrom52WeekLowPercent: 20,
    fiftyTwoWeekHigh: 111,
    fiftyTwoWeekLow: 83,
    historyStatus: 'sufficient',
    observationCount: 20,
    oldestObservationAt: '2025-08-31T12:00:00.000Z',
    newestObservationAt: '2026-08-31T12:00:00.000Z',
    recentRunUp: false,
    recentRunUpReasons: [],
    ...overrides,
  };
}

function signal(overrides: Partial<PaperSignalInput> = {}): PaperSignalInput {
  return {
    ticker: 'ELF',
    canonicalIncluded: true,
    growthScore: 100,
    healthScore: 78,
    coverageScore: 100,
    currentCollectionConfirmed: true,
    priceContext: priceContext(),
    ...overrides,
  };
}

describe('paper-strategy-v1 signal policy', () => {
  it('exports the exact business and market states reused by read-only surfaces', () => {
    expect(derivePaperBusinessState(signal())).toBe('strong');
    expect(derivePaperBusinessState(signal({ healthScore: 64 }))).toBe('mixed');
    expect(derivePaperMarketSetupState(priceContext())).toBe('not_overheated');
    expect(derivePaperMarketSetupState(priceContext({ historyStatus: 'insufficient' }))).toBe('unknown');
  });

  it('keeps the all-picks baseline eligible even when current data is missing', () => {
    const [baseline, entryAware] = evaluatePaperStrategies(signal({
      currentCollectionConfirmed: false,
      priceContext: priceContext({ historyStatus: 'insufficient' }),
    }));

    expect(baseline).toMatchObject({
      strategy: 'all_picks_baseline',
      eligibility: 'eligible',
      freshnessState: 'not_current_collection',
    });
    expect(entryAware.eligibility).toBe('skipped');
    expect(entryAware.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('did not confirm current market data'),
      expect.stringContaining('insufficient'),
    ]));
  });

  it('admits entry-aware only when business, freshness, and price-history gates all pass', () => {
    const [, entryAware] = evaluatePaperStrategies(signal());
    expect(entryAware).toMatchObject({
      eligibility: 'eligible',
      businessState: 'strong',
      marketSetupState: 'not_overheated',
      freshnessState: 'current_collection_confirmed',
    });
  });

  it('does not treat already-elevated momentum as a positive entry gate', () => {
    const [, entryAware] = evaluatePaperStrategies(signal({
      priceContext: priceContext({
        recentRunUp: true,
        recentRunUpReasons: ['1-month return is +24.0%'],
      }),
    }));
    expect(entryAware.eligibility).toBe('skipped');
    expect(entryAware.marketSetupState).toBe('overheated');
    expect(entryAware.reasons.join(' ')).toContain('+24.0%');
  });

  it('requires all three explicit business thresholds for entry-aware', () => {
    const [, entryAware] = evaluatePaperStrategies(signal({ healthScore: 64 }));
    expect(entryAware.eligibility).toBe('skipped');
    expect(entryAware.businessState).toBe('mixed');
    expect(entryAware.reasons[0]).toContain('Health >= 65');
  });

  it('skips both policies for a non-included decision', () => {
    const evaluations = evaluatePaperStrategies(signal({ canonicalIncluded: false }));
    expect(evaluations.every((item) => item.eligibility === 'skipped')).toBe(true);
  });
});

describe('paper execution accounting and freshness', () => {
  it('fails deferred automation only during an expected New York regular session', () => {
    expect(shouldFailIncompletePaperExecution(2, 0, new Date('2026-09-14T13:35:00Z'))).toBe(true);
    expect(shouldFailIncompletePaperExecution(0, 0, new Date('2026-09-14T13:35:00Z'))).toBe(false);
    expect(shouldFailIncompletePaperExecution(2, 0, new Date('2026-09-13T13:35:00Z'))).toBe(false);
    expect(shouldFailIncompletePaperExecution(2, 0, new Date('2026-09-14T20:05:00Z'))).toBe(false);
  });

  it('fails missing held marks even with no pending orders, only during an expected session', () => {
    expect(shouldFailIncompletePaperExecution(0, 1, new Date('2026-09-14T13:35:00Z'))).toBe(true);
    expect(shouldFailIncompletePaperExecution(0, 1, new Date('2026-09-13T13:35:00Z'))).toBe(false);
    expect(shouldFailIncompletePaperExecution(0, 1, new Date('2026-09-14T20:05:00Z'))).toBe(false);
  });

  it('models the public Lightyear US-share commission floor and cap', () => {
    expect(paperCommissionUsd(100)).toBe(0.1);
    expect(paperCommissionUsd(2_000)).toBe(1);
    expect(paperCommissionUsd(50_000)).toBe(1);
    expect(paperCommissionUsd(0)).toBe(0);
  });

  it('accepts only a fresh USD quote from a regular session', () => {
    const now = new Date('2026-08-31T14:00:00.000Z');
    expect(assessPaperExecutionQuote({
      price: 105,
      currency: 'USD',
      marketState: 'REGULAR',
      marketTime: '2026-08-31T13:59:00.000Z',
    }, now)).toEqual({ executable: true, reason: null });

    expect(assessPaperExecutionQuote({
      price: 105,
      currency: 'USD',
      marketState: 'CLOSED',
      marketTime: '2026-08-31T13:59:00.000Z',
    }, now).executable).toBe(false);
    expect(assessPaperExecutionQuote({
      price: 105,
      currency: 'USD',
      marketState: 'REGULAR',
      marketTime: '2026-08-31T13:00:00.000Z',
    }, now).executable).toBe(false);
  });
});
