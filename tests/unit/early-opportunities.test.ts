import { describe, expect, it } from 'vitest';
import { evaluateEarlyFundamentals, evaluateEarlyHistory, type EarlyHistory } from '../../src/lib/early-opportunities';
import { makeFinancials } from '../fixtures/financials';
import type { MarketRadarStock } from '../../src/lib/market-radar';
const now = new Date('2026-10-01T15:00:00Z');
const stock: MarketRadarStock = { ticker: 'EARLY', name: 'Early', price: 110, marketAt: now.toISOString(),
  changePercent: 1, marketCap: 1e9, volume: 100, relativeVolume: 1, channels: ['growth_technology_stocks'], warnings: [] };
const financial = () => makeFinancials({ revenue: { value: 150, previousValue: 100, yoy: 50 }, operating_cash_flow: { value: 20 } });
function chart(base = 100): EarlyHistory {
  return { meta: { symbol: 'EARLY', currency: 'USD' }, quotes: [30, 90, 180].map(days => ({ date: new Date(now.getTime() - days * 86400000), close: base })) };
}
describe('early discovery rules', () => {
  it('requires real business evidence and all three price references before marking watch', () => {
    const row = evaluateEarlyFundamentals(stock, financial(), now);
    const result = evaluateEarlyHistory(row, chart(), now);
    expect(result.state).toBe('watch');
    expect(result.priceObservations).toHaveLength(3);
    expect(row.facts).toHaveLength(3);
    expect(evaluateEarlyHistory(row, { ...chart(), quotes: [] }, now).state).toBe('unknown');
  });
  it('excludes already elevated prices, weak growth and negative cash flow', () => {
    expect(evaluateEarlyFundamentals({ ...stock, changePercent: 5 }, financial(), now).state).toBe('excluded');
    expect(evaluateEarlyHistory(evaluateEarlyFundamentals(stock, financial(), now), chart(80), now).state).toBe('excluded');
    const weak = financial(); weak.metrics.revenue!.latest.value = 110;
    expect(evaluateEarlyFundamentals(stock, weak, now).state).toBe('excluded');
    const burning = financial(); burning.metrics.operating_cash_flow!.latest.value = -1;
    expect(evaluateEarlyFundamentals(stock, burning, now).state).toBe('excluded');
  });
  it('does not turn missing, stale, future or mismatched evidence into an early label', () => {
    expect(evaluateEarlyFundamentals(stock, undefined, now).state).toBe('unknown');
    for (const date of ['2024-01-01', '2027-01-01']) {
      const f = financial(); f.metrics.revenue!.latest.periodEnd = date;
      expect(evaluateEarlyFundamentals(stock, f, now).state).toBe('unknown');
    }
    const f = financial(); f.metrics.operating_cash_flow!.latest.periodKind = 'quarter';
    expect(evaluateEarlyFundamentals(stock, f, now).state).toBe('unknown');
    expect(evaluateEarlyFundamentals({ ...stock, marketAt: '2026-10-02T15:00:00Z' }, financial(), now).state).toBe('unknown');
    const row = evaluateEarlyFundamentals(stock, financial(), now);
    expect(evaluateEarlyHistory(row, { ...chart(), events: { splits: [{}] } }, now).state).toBe('unknown');
    expect(evaluateEarlyHistory(row, { ...chart(), meta: { symbol: 'WRONG', currency: 'USD' } }, now).state).toBe('unknown');
    const future = evaluateEarlyHistory(row, { ...chart(), quotes: chart().quotes.map(q => ({ ...q, date: new Date('2027-01-01') })) }, now);
    expect(future.state).toBe('unknown'); expect(future.priceObservations).toEqual([]);
  });
});
