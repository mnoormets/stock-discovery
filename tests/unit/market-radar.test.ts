import { describe, expect, it } from 'vitest';
import { fetchMarketRadar, normalizeMarketRadarRows, MARKET_RADAR_CHANNELS } from '../../src/lib/market-radar';
const now = new Date('2026-09-30T19:00:00Z');
const quote = { symbol: 'META', quoteType: 'EQUITY', currency: 'USD', exchange: 'NMS',
  regularMarketTime: new Date('2026-09-30T18:55:00Z'), regularMarketPrice: 100,
  regularMarketChangePercent: 3, regularMarketVolume: 200, averageDailyVolume3Month: 100 };
describe('market radar coverage and evidence', () => {
  it('validates a quote against receipt time when it arrives after the collection started', async () => {
    const received = new Date(now.getTime() + 60000);
    const result = await fetchMarketRadar(now, async () => ({ quotes: [{ ...quote, regularMarketTime: received }] }), async () => received);
    expect(result.stocks[0].price).toBe(100);
    const future = await fetchMarketRadar(now, async () => ({ quotes: [{ ...quote, regularMarketTime: new Date(received.getTime() + 1000) }] }), async () => received);
    expect(future.stocks[0].price).toBeNull();
  });
  it('keeps a mega-cap and an unscored name without social input; rejects funds and non-US listings', () => {
    const rows = normalizeMarketRadarRows({ quotes: [quote, { ...quote, symbol: 'GLND' },
      { ...quote, symbol: 'ETF', quoteType: 'ETF' }, { ...quote, exchange: 'LSE' }] }, 'day_gainers', now);
    expect(rows.map((r) => r.ticker)).toEqual(['META', 'GLND']);
    expect(rows[0].relativeVolume).toBe(2);
  });
  it('preserves unknown data and never relabels stale/future prices as fresh', () => {
    for (const time of [null, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z']) {
      const [row] = normalizeMarketRadarRows({ quotes: [{ ...quote, regularMarketTime: time }] }, 'day_gainers', now);
      expect(row.price).toBeNull(); expect(row.changePercent).toBeNull(); expect(row.warnings.length).toBe(1);
    }
    const [row] = normalizeMarketRadarRows({ quotes: [{ ...quote, regularMarketVolume: null, regularMarketChangePercent: null }] }, 'day_gainers', now);
    expect(row.relativeVolume).toBeNull(); expect(row.changePercent).toBeNull();
  });
  it('bounds input, deduplicates overlapping screens, and keeps failed channels explicit', async () => {
    const result = await fetchMarketRadar(now, async (channel) => {
      if (channel === 'most_actives') throw new Error('unavailable');
      return { quotes: [quote, quote] };
    });
    expect(result.stocks).toHaveLength(1);
    expect(result.stocks[0].channels).toHaveLength(MARKET_RADAR_CHANNELS.length - 1);
    expect(result.channels.find((c) => c.id === 'most_actives')?.status).toBe('failed');
    expect(normalizeMarketRadarRows({ quotes: Array(40).fill(quote) }, 'day_gainers', now)).toHaveLength(25);
  });
  it('rejects broken response envelopes instead of silently treating them as an empty market', () => {
    expect(() => normalizeMarketRadarRows({}, 'day_gainers', now)).toThrow();
  });
});
