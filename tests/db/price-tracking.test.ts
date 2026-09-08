import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectTrackedPrices, getPriceTrackingQueue, getPriceTrackingSummary } from '../../src/lib/price-tracking';
import { recordDiscoveryRun, refreshCandidateOutcomes } from '../../src/lib/discovery-validation';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

function quotes(tickers: string[], marketTime: string, price = 110) {
  return new Map(tickers.map((ticker): [string, YahooExecutionQuote] => [ticker, {
    ticker, marketTime, price, currency: 'USD', marketState: 'CLOSED', source: 'yahoo',
    raw: { marketCap: 1_000_000_000, regularMarketVolume: 1000 },
  }]));
}

describe('continued price tracking', () => {
  it('keeps canonical picks and active research after discovery, with separate provenance and quote deduplication', async () => {
    const id = await insertCompany('ELF');
    await insertCompany('SPY');
    const manual = await insertCompany('MANUAL');
    await recordDiscoveryRun([], [makeDecisionInput({ companyId: id, ticker: 'ELF' })], new Date('2026-09-01T12:00:00Z'), 'rklb_daily');
    await recordDiscoveryRun([], [makeDecisionInput({ companyId: manual, ticker: 'MANUAL' })], new Date('2026-09-01T12:00:00Z'), 'rklb');
    await pool.query("INSERT INTO portfolio_positions (company_id,ticker,quantity,average_buy_price,status) VALUES ($1,'ELF',0,0,'watch')", [id]);
    const before = (await pool.query('SELECT * FROM discovery_decisions ORDER BY id')).rows;
    const now = new Date('2026-09-06T12:00:00Z');
    const queue = await getPriceTrackingQueue(now);
    expect(queue.map((row) => row.ticker)).toEqual(['SPY', 'ELF']);
    expect(queue[1].reasons).toEqual(['active research', 'outcome horizon']);
    const fetcher = async (tickers: string[]) => quotes(tickers, '2026-09-04T20:00:00Z');
    expect(await collectTrackedPrices({ now, quoteFetcher: fetcher })).toMatchObject({ saved: 2, attempted: 2 });
    expect(await collectTrackedPrices({ now, quoteFetcher: fetcher })).toMatchObject({ saved: 0, attempted: 0 });
    expect(await collectTrackedPrices({ now: new Date('2026-09-07T12:00:00Z'), quoteFetcher: fetcher })).toMatchObject({ unchanged: 2, saved: 0 });
    expect(await collectTrackedPrices({ now: new Date('2026-09-08T12:00:00Z'), quoteFetcher: fetcher })).toMatchObject({ unchanged: 2, stale: 0 });
    const prices = (await pool.query('SELECT captured_at, market_at, source FROM price_snapshots')).rows;
    expect(prices).toHaveLength(2);
    expect(prices.every((row) => row.captured_at.toISOString() === now.toISOString()
      && row.market_at.toISOString() === '2026-09-04T20:00:00.000Z' && row.source === 'yahoo-tracking-v1')).toBe(true);
    expect((await pool.query('SELECT * FROM discovery_decisions ORDER BY id')).rows).toEqual(before);
    expect((await pool.query('SELECT count(*)::int AS count FROM collection_run_items')).rows[0].count).toBe(0);
    expect((await getPriceTrackingSummary()).rows).toHaveLength(2);
  });

  it('enforces the daily cap across repeated runs and gives unattempted symbols the next day', async () => {
    await pool.query("INSERT INTO companies (ticker,name,source) SELECT 'T' || lpad(n::text,3,'0'), 'Test', 'test' FROM generate_series(1,55) n");
    await pool.query("INSERT INTO portfolio_positions (company_id,ticker,quantity,average_buy_price,status) SELECT id,ticker,0,0,'watch' FROM companies");
    await insertCompany('SPY');
    const now = new Date('2026-09-06T12:00:00Z');
    expect(await collectTrackedPrices({ now, quoteFetcher: async () => new Map() })).toMatchObject({ attempted: 50, missing: 50, deferred: 6 });
    expect(await collectTrackedPrices({ now, quoteFetcher: async () => { throw Error('must not fetch'); } })).toMatchObject({ attempted: 0, deferred: 6 });
    const next = await getPriceTrackingQueue(new Date('2026-09-07T12:00:00Z'));
    expect(next.slice(1,7).map((row) => row.ticker)).toEqual(['T050','T051','T052','T053','T054','T055']);
  });

  it('records stale, invalid and failed quotes without manufacturing prices', async () => {
    await insertCompany('SPY');
    const now = new Date('2026-09-08T14:00:00Z');
    expect(await collectTrackedPrices({ now, quoteFetcher: async (tickers) => quotes(tickers, '2026-09-02T20:00:00Z') })).toMatchObject({ stale: 1, saved: 0 });
    expect(await collectTrackedPrices({ now: new Date('2026-09-09T14:00:00Z'), quoteFetcher: async (tickers) => quotes(tickers, '2026-09-10T20:00:00Z') })).toMatchObject({ invalid: 1 });
    expect(await collectTrackedPrices({ now: new Date('2026-09-10T14:00:00Z'), quoteFetcher: async () => { throw Error('provider unavailable'); } })).toMatchObject({ failed: 1 });
    expect((await pool.query('SELECT count(*)::int AS count FROM price_snapshots')).rows[0].count).toBe(0);
  });

  it('requires market time to reach the outcome target and preserves measured outcomes', async () => {
    const id = await insertCompany('ELF');
    await insertCompany('SPY');
    await recordDiscoveryRun([], [makeDecisionInput({ companyId: id, ticker: 'ELF' })], new Date('2026-08-31T12:00:00Z'), 'rklb_daily');
    const day = new Date('2026-09-07T14:00:00Z');
    await collectTrackedPrices({ now: day, quoteFetcher: async (tickers) => quotes(tickers, '2026-09-07T11:00:00Z') });
    await refreshCandidateOutcomes(day);
    const read = async () => (await pool.query("SELECT * FROM candidate_outcomes WHERE horizon = '1w'")).rows[0];
    expect((await read()).status).toBe('pending');
    const next = new Date('2026-09-08T14:00:00Z');
    await collectTrackedPrices({ now: next, quoteFetcher: async (tickers) => quotes(tickers, '2026-09-08T13:59:00Z', 120) });
    await refreshCandidateOutcomes(next);
    const measured = await read();
    expect(measured.status).toBe('measured');
    expect(Number(measured.return_percent)).toBe(20);
    await collectTrackedPrices({ now: new Date('2026-09-09T14:00:00Z'), quoteFetcher: async (tickers) => quotes(tickers, '2026-09-09T13:59:00Z', 150) });
    await refreshCandidateOutcomes(new Date('2026-09-09T14:00:00Z'));
    expect(await read()).toEqual(measured);
  });
});
