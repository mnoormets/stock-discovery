import { describe, expect, it } from 'vitest';
import { collectGrowthOpportunities, evaluateGrowthFundamentals, evaluateGrowthHistory, selectGrowthEvidence } from '../../src/lib/growth-opportunities';
import { makePoint } from '../fixtures/financials';
import type { FinancialPoint } from '../../src/lib/company-financials';
import type { MarketRadarStock, MarketRadarSnapshot } from '../../src/lib/market-radar';
import type { EarlyHistory } from '../../src/lib/early-opportunities';
const now = new Date('2026-10-07T15:00:00Z');
const stock: MarketRadarStock = { ticker: 'TEST', name: 'Test', price: 140, marketAt: now.toISOString(),
  changePercent: 6, marketCap: 1e12, volume: 100, relativeVolume: 2, channels: ['growth_technology_stocks'], warnings: [] };
function facts(): FinancialPoint[] {
  const period = { periodStart: '2025-12-28', periodEnd: '2026-06-27', periodKind: 'ytd' as const,
    filedAt: '2026-08-05', accessionNumber: 'same-filing' };
  return [makePoint('revenue', 21789, period), makePoint('operating_cash_flow', 5321, period),
    makePoint('revenue', 15123, { ...period, periodStart: '2024-12-29', periodEnd: '2025-06-28' }),
    makePoint('revenue', 11536, { ...period, periodStart: '2026-03-29', periodKind: 'quarter' })];
}
const chart = (close = 100): EarlyHistory => ({ meta: { symbol: stock.ticker, currency: 'USD' },
  quotes: [30, 90, 180].map(d => ({ date: new Date(now.getTime() - d * 86400000), close })) });
describe('versioned coherent-period growth and momentum research', () => {
  it('selects available YTD evidence instead of mismatching quarter revenue and YTD cash flow', () => {
    const selected = selectGrowthEvidence(facts(), now);
    expect(selected.map(p => p.value)).toEqual([21789, 15123, 5321]);
    const row = evaluateGrowthFundamentals(stock, facts(), now);
    expect(row.revenueGrowth).toBeCloseTo(44.08, 2);
    expect(evaluateGrowthHistory(row, stock, chart(), now).state).toBe('momentum');
    const smallMove = { ...stock, price: 110, changePercent: 1 };
    expect(evaluateGrowthHistory(evaluateGrowthFundamentals(smallMove, facts(), now), smallMove, chart(), now).state).toBe('early');
  });
  it('does not stitch differing starts, currencies, filings or unequal durations into growth', () => {
    for (const patch of [{ periodStart: '2026-03-29' }, { unit: 'EUR' }, { accessionNumber: 'other-filing' }]) {
      const p = facts(); Object.assign(p[1], patch); expect(selectGrowthEvidence(p, now)).toEqual([]);
    }
    const p = facts(); p[2].periodStart = '2025-03-29'; expect(selectGrowthEvidence(p, now)).toEqual([]);
  });
  it('never substitutes an older profitable period for the latest negative cash-flow evidence', () => {
    const p = facts(); p[1].value = -1;
    p.push(makePoint('operating_cash_flow', 999, { periodStart: '2024-01-01', periodEnd: '2024-12-31' }));
    expect(evaluateGrowthFundamentals(stock, p, now).state).toBe('excluded');
    p[2].value = 0; expect(evaluateGrowthFundamentals(stock, p, now).state).toBe('excluded');
  });
  it('rejects future filings, stale prices and stale financial periods', () => {
    const p = facts(); p.forEach(f => f.filedAt = '2026-10-08');
    expect(evaluateGrowthFundamentals(stock, p, now).facts).toEqual([]);
    expect(evaluateGrowthFundamentals({ ...stock, marketAt: '2026-09-01T15:00:00Z' }, facts(), now).facts).toEqual([]);
    expect(selectGrowthEvidence(facts(), new Date('2028-01-01'))).toEqual([]);
  });
  it('requires complete history and positive 1/3-month momentum, not a session spike alone', () => {
    const row = evaluateGrowthFundamentals(stock, facts(), now);
    expect(evaluateGrowthHistory(row, stock, { ...chart(), quotes: [] }, now).state).toBe('unknown');
    expect(evaluateGrowthHistory(row, stock, chart(200), now).state).toBe('excluded');
    const smallMove = { ...stock, price: 110 };
    expect(evaluateGrowthHistory(evaluateGrowthFundamentals(smallMove, facts(), now), smallMove, chart(), now).state).toBe('excluded');
  });
  it('rejects split/identity issues and excludes an intraday bar containing a later daily close', () => {
    const row = evaluateGrowthFundamentals(stock, facts(), now);
    expect(evaluateGrowthHistory(row, stock, { ...chart(), events: { splits: [{}] } }, now).state).toBe('unknown');
    expect(evaluateGrowthHistory(row, stock, { ...chart(), meta: { symbol: 'WRONG', currency: 'USD' } }, now).state).toBe('unknown');
    const c = chart(); c.quotes.push({ date: new Date('2026-10-07T13:30:00Z'), close: 999 }, { date: new Date('2026-10-08'), close: 999 });
    expect(evaluateGrowthHistory(row, stock, c, now).priceObservations).toHaveLength(3);
  });
  it('bounds history work, explains deferrals and keeps failures unknown without hardcoded ticker preferences', async () => {
    const stocks = Array.from({ length: 22 }, (_, i) => ({ ...stock, ticker: 'S' + String(i).padStart(2, '0') }));
    const radar: MarketRadarSnapshot = { version: 'market-radar-v1', observedAt: now.toISOString(), channels: [], stocks };
    const map = new Map(stocks.map(s => [s.ticker, facts()])); let calls = 0;
    const result = await collectGrowthOpportunities(radar, now, map, async () => { calls++; throw new Error('unavailable'); });
    expect(calls).toBe(20); expect(result.historyDeferred).toBe(2);
    expect(result.rows.every(r => r.state === 'unknown')).toBe(true);
    expect(result.rows[21].reasons.join(' ')).toContain('deferred');
    expect(radar.growth).toBeUndefined(); expect(radar.early).toBeUndefined();
  });
});
