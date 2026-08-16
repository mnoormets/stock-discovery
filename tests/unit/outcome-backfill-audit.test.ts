import { describe, expect, it } from 'vitest';
import {
  buildOutcomeBackfillAudit,
  type OutcomeBackfillAuditSourceItem,
} from '../../src/lib/outcome-backfill-audit';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function item(overrides: Partial<OutcomeBackfillAuditSourceItem> = {}): OutcomeBackfillAuditSourceItem {
  return {
    itemId: 1,
    runId: 1,
    runStartedAt: '2026-08-01T08:00:00.000Z',
    symbol: 'AUDT',
    observedAt: daysAgo(10),
    snapshot30d: false,
    snapshot90d: false,
    snapshot180d: false,
    price30d: false,
    price90d: false,
    price180d: false,
    ...overrides,
  };
}

describe('Outcome Snapshot Backfill Audit V1 calculations', () => {
  it('keeps items younger than 30 days in a deterministic too-recent state', () => {
    const audit = buildOutcomeBackfillAudit([item()], NOW);
    expect(audit.summary).toMatchObject({
      totalItems: 1,
      eligible30dCount: 0,
      eligible90dCount: 0,
      eligible180dCount: 0,
      tooRecentCount: 1,
      missingPriceDataCount: 0,
    });
    expect(audit.symbols[0].missingReason).toBe('Too recent');
  });

  it('applies inclusive exact 30D, 90D and 180D boundaries', () => {
    const ages = [29, 30, 89, 90, 179, 180];
    const audit = buildOutcomeBackfillAudit(ages.map((days, index) => item({
      itemId: index + 1,
      symbol: `AGE${days}`,
      observedAt: daysAgo(days),
    })), NOW);
    expect(audit.summary.eligible30dCount).toBe(5);
    expect(audit.summary.eligible90dCount).toBe(3);
    expect(audit.summary.eligible180dCount).toBe(1);
    expect(audit.horizons.map((horizon) => horizon.tooRecentCount)).toEqual([1, 3, 5]);
  });

  it('reports missing local price data only for due unmeasured opportunities', () => {
    const audit = buildOutcomeBackfillAudit([item({ observedAt: daysAgo(200) })], NOW);
    expect(audit.summary.missingPriceDataCount).toBe(1);
    expect(audit.horizons.map((horizon) => horizon.missingPriceDataCount)).toEqual([1, 1, 1]);
    expect(audit.symbols[0]).toMatchObject({
      hasRequiredPriceData30d: false,
      hasRequiredPriceData90d: false,
      hasRequiredPriceData180d: false,
      missingReason: 'Missing price data',
    });
  });

  it('does not double-count an existing snapshot as missing or missing-price', () => {
    const audit = buildOutcomeBackfillAudit([item({
      observedAt: daysAgo(40),
      snapshot30d: true,
    })], NOW);
    expect(audit.horizons[0]).toMatchObject({
      eligibleItemCount: 1,
      alreadyMeasuredCount: 1,
      missingSnapshotCount: 0,
      missingPriceDataCount: 0,
    });
    expect(audit.summary.alreadyMeasuredSymbols).toBe(1);
    expect(audit.symbols[0].missingReason).toBe('Already measured');
  });

  it('marks a due unmeasured symbol ready only when required local prices exist', () => {
    const audit = buildOutcomeBackfillAudit([item({
      observedAt: daysAgo(100),
      price30d: true,
      price90d: true,
    })], NOW);
    expect(audit.symbols[0]).toMatchObject({
      eligible30d: true,
      eligible90d: true,
      eligible180d: false,
      hasRequiredPriceData30d: true,
      hasRequiredPriceData90d: true,
      missingReason: 'Eligible for backfill',
    });
    expect(audit.runs[0]).toMatchObject({ missingSnapshots: 2, missingPriceData: 0 });
  });

  it('returns a safe zero-state without fabricated findings', () => {
    const audit = buildOutcomeBackfillAudit([], NOW, false);
    expect(audit.summary).toEqual({
      totalItems: 0,
      distinctSymbols: 0,
      alreadyMeasuredSymbols: 0,
      unmeasuredSymbols: 0,
      eligible30dCount: 0,
      eligible90dCount: 0,
      eligible180dCount: 0,
      tooRecentCount: 0,
      missingPriceDataCount: 0,
    });
    expect(audit.priceTableAvailable).toBe(false);
    expect(audit.highlights).toEqual([]);
  });
});
