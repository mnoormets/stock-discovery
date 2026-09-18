import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getPaperPerformanceDashboard } from '../../src/lib/paper-performance';
import {
  executePendingPaperOrders,
  paperStrategySchemaAvailable,
  recordPaperStrategySignals,
} from '../../src/lib/paper-strategy-store';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function canonicalRun(options: { ticker?: string; healthScore?: number } = {}): Promise<number> {
  const ticker = options.ticker ?? 'ELF';
  const collection = await startCollectionRun('paper-strategy-test');
  const companyId = await insertCompany(ticker);
  await insertCompany('SPY');
  await insertPriceSnapshot(companyId, 90, '2026-08-01T12:00:00.000Z');
  const latestPriceId = await insertPriceSnapshot(companyId, 100, '2026-08-31T12:00:00.000Z');
  await recordCollectionRunItem({
    collectionRunId: collection.id,
    ticker,
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    companyId,
  });
  await succeedCollectionRun(collection.id, { itemCount: 1 });
  const run = await recordDiscoveryRun(
    ['paper strategy fixture'],
    [makeDecisionInput({
      companyId,
      ticker,
      healthScore: options.healthScore ?? 78,
      decisionPrice: 100,
      priceSnapshotId: latestPriceId,
    })],
    new Date('2026-08-31T12:00:00.000Z'),
    'rklb_daily',
    collection.id,
  );
  return run.runId;
}

describe('paper strategy signal ledger', () => {
  it('marks held stocks and SPY on a later day with no new orders, without changing fills', async () => {
    await recordPaperStrategySignals(await canonicalRun());
    const quote = (ticker: string, price: number, marketTime: string): YahooExecutionQuote => ({
      ticker, price, currency: 'USD', marketState: 'REGULAR', marketTime, source: 'yahoo', raw: {},
    });
    await executePendingPaperOrders({
      now: new Date('2026-08-31T14:00:00Z'),
      quoteFetcher: async () => new Map([
        ['ELF', quote('ELF', 100, '2026-08-31T13:59:00Z')],
        ['SPY', quote('SPY', 500, '2026-08-31T13:59:00Z')],
      ]),
    });
    const before = (await pool.query('SELECT * FROM paper_strategy_orders ORDER BY id')).rows;
    let requested: string[] = [];
    const now = new Date('2026-09-01T14:00:00Z');
    const quoteFetcher = async (tickers: string[]) => {
      requested = tickers;
      return new Map([
        ['ELF', quote('ELF', 110, '2026-09-01T13:59:00Z')],
        ['SPY', quote('SPY', 505, '2026-09-01T13:59:00Z')],
      ]);
    };
    const result = await executePendingPaperOrders({ now, quoteFetcher });
    expect(requested.sort()).toEqual(['ELF', 'SPY']);
    expect(result).toMatchObject({ pendingOrders: 0, filledOrders: 0, markedTickers: 2 });
    expect((await executePendingPaperOrders({ now, quoteFetcher })).markedTickers).toBe(0);
    expect((await pool.query('SELECT * FROM paper_strategy_orders ORDER BY id')).rows).toEqual(before);
    const book = (await getPaperPerformanceDashboard(now)).books.find(
      (item) => item.strategy === 'all_picks_baseline' && item.book === 'strategy',
    )!;
    expect(book.currentValueUsd).toBe(110);
    expect(book.profitUsd).toBeCloseTo(9.9);
    expect(book.positions).toHaveLength(1);
    expect(book.positions[0]).toMatchObject({ ticker: 'ELF', averageBuyPrice: 100,
      firstBoughtAt: '2026-08-31T14:00:00.000Z', investedUsd: 100.1, currentValueUsd: 110, open: true });
    expect(book.positions[0].profitUsd).toBeCloseTo(9.9);

    await executePendingPaperOrders({
      now: new Date('2026-09-02T14:00:00Z'),
      quoteFetcher: async () => new Map([['SPY', quote('SPY', 510, '2026-09-02T13:59:00Z')]]),
    });
    const stale = (await getPaperPerformanceDashboard(new Date('2026-09-02T14:00:00Z'))).books.find(
      (item) => item.strategy === 'all_picks_baseline' && item.book === 'strategy',
    )!;
    expect(stale.valuationComplete).toBe(false);
    expect(stale.profitUsd).toBeNull();
    expect(stale.positions[0].profitUsd).toBeNull();
    expect(stale.positions[0].latestPrice).toBeNull();
    expect(stale.valuationIssues).toContain('ELF: mark date differs from SPY.');

    // Same-date quotes must also be close in time; missing and non-USD marks
    // cannot turn a partial portfolio into a reported return.
    await pool.query(`INSERT INTO paper_strategy_marks (ticker, price, currency, market_time, marked_at, source, quote_payload)
      VALUES ('ELF', 110, 'USD', '2026-09-02T13:38:00Z', '2026-09-02T14:00:00Z', 'yahoo', '{}')`);
    const readBook = async () => (await getPaperPerformanceDashboard(new Date('2026-09-02T14:00:00Z')))
      .books.find((item) => item.strategy === 'all_picks_baseline' && item.book === 'strategy')!;
    expect((await readBook()).valuationIssues).toContain('ELF: mark time differs from SPY by more than 20 minutes.');
    await pool.query(`INSERT INTO paper_strategy_marks (ticker, price, currency, market_time, marked_at, source, quote_payload)
      VALUES ('ELF', 110, 'EUR', '2026-09-02T13:40:00Z', '2026-09-02T14:00:00Z', 'yahoo', '{}')`);
    expect((await readBook()).currentValueUsd).toBeNull();
    expect((await readBook()).valuationIssues).toContain('ELF: valid USD mark missing.');
    const outdated = (await getPaperPerformanceDashboard(new Date('2026-09-08T14:00:00Z')))
      .books.find((item) => item.strategy === 'all_picks_baseline' && item.book === 'strategy')!;
    expect(outdated.valuationIssues).toContain('SPY: recent reference mark unavailable.');
  });

  it('combines repeated purchases by quantity and includes both purchase fees', async () => {
    const first = await canonicalRun();
    await recordPaperStrategySignals(first);
    const execute = async (time: string, price: number) => executePendingPaperOrders({
      now: new Date(time),
      quoteFetcher: async () => new Map(['ELF', 'SPY'].map((ticker) => [ticker, {
        ticker, price: ticker === 'ELF' ? price : 500, currency: 'USD', marketState: 'REGULAR',
        marketTime: time, source: 'yahoo', raw: {},
      }])),
    });
    await execute('2026-08-31T14:00:00Z', 100);
    const companyId = Number((await pool.query("SELECT id FROM companies WHERE ticker='ELF'")).rows[0].id);
    const collectionId = Number((await pool.query('SELECT collection_run_id FROM discovery_runs WHERE id=$1', [first])).rows[0].collection_run_id);
    const second = await recordDiscoveryRun([], [makeDecisionInput({ companyId, ticker: 'ELF' })],
      new Date('2026-09-01T12:00:00Z'), 'rklb_daily', collectionId);
    await recordPaperStrategySignals(second.runId);
    await execute('2026-09-01T14:00:00Z', 50);
    const book = (await getPaperPerformanceDashboard(new Date('2026-09-01T14:00:00Z'))).books
      .find((item) => item.strategy === 'all_picks_baseline' && item.book === 'strategy')!;
    expect(book.positions).toHaveLength(1);
    expect(book.positions[0].averageBuyPrice).toBeCloseTo(200 / 3);
    expect(book.positions[0].investedUsd).toBeCloseTo(200.2);
    expect(book.positions[0].currentValueUsd).toBeCloseTo(150);
    expect(book.positions[0].profitUsd).toBeCloseTo(-50.2);
    expect(book.profitUsd).toBeCloseTo(book.positions[0].profitUsd!);
  });

  it('keeps an empty portfolio valuation unknown instead of inventing zero P/L', async () => {
    const dashboard = await getPaperPerformanceDashboard(new Date('2026-08-31T14:00:00Z'));
    expect(dashboard.available).toBe(true);
    expect(dashboard.books).toHaveLength(4);
    expect(dashboard.books.every((book) => book.positions.length === 0)).toBe(true);
    expect(dashboard.books.every((book) => book.investedUsd === 0)).toBe(true);
    expect(dashboard.books.every((book) => book.currentValueUsd == null && book.profitUsd == null)).toBe(true);
  });

  it('is schema-versioned, idempotent per canonical run, and pairs every eligible cash flow with SPY', async () => {
    expect(await paperStrategySchemaAvailable()).toBe(true);
    const runId = await canonicalRun();

    const first = await recordPaperStrategySignals(runId);
    const second = await recordPaperStrategySignals(runId);

    expect(first).toEqual({
      runId,
      decisions: 1,
      insertedOrders: 4,
      existingOrders: 0,
      pendingOrders: 4,
      skippedOrders: 0,
      insertedExitOrders: 0,
    });
    expect(second).toEqual({
      runId,
      decisions: 1,
      insertedOrders: 0,
      existingOrders: 4,
      pendingOrders: 0,
      skippedOrders: 0,
      insertedExitOrders: 0,
    });

    const { rows } = await pool.query(
      `SELECT strategy_key, book_key, signal_ticker, instrument_ticker,
              status, notional_usd::text, eligibility_snapshot
       FROM paper_strategy_orders ORDER BY strategy_key, book_key`,
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.status === 'pending' && row.notional_usd === '100')).toBe(true);
    expect(rows.filter((row) => row.book_key === 'benchmark').every((row) => row.instrument_ticker === 'SPY')).toBe(true);
    expect(rows.filter((row) => row.book_key === 'strategy').every((row) => row.instrument_ticker === 'ELF')).toBe(true);
    expect(rows.every((row) => row.eligibility_snapshot.policyVersion === 'paper-strategy-v1')).toBe(true);
  });

  it('keeps baseline pending but freezes entry-aware failures as skipped facts', async () => {
    const runId = await canonicalRun({ ticker: 'MIXD', healthScore: 64 });
    const result = await recordPaperStrategySignals(runId);
    expect(result).toMatchObject({ pendingOrders: 2, skippedOrders: 2 });

    const { rows } = await pool.query(
      `SELECT strategy_key, book_key, status, skip_reason
       FROM paper_strategy_orders ORDER BY strategy_key, book_key`,
    );
    expect(rows.filter((row) => row.strategy_key === 'all_picks_baseline')
      .every((row) => row.status === 'pending')).toBe(true);
    expect(rows.filter((row) => row.strategy_key === 'entry_aware')
      .every((row) => row.status === 'skipped' && row.skip_reason.includes('Health >= 65'))).toBe(true);
  });

  it('rejects paper signals for a non-canonical run', async () => {
    const companyId = await insertCompany('MANU');
    const run = await recordDiscoveryRun(
      ['manual fixture'],
      [makeDecisionInput({ companyId, ticker: 'MANU' })],
      new Date('2026-08-31T12:00:00.000Z'),
      'rklb',
    );
    await expect(recordPaperStrategySignals(run.runId)).rejects.toThrow('Canonical discovery run');
  });

  it('fills strategy and same-cash-flow SPY orders once from fresh regular-session quotes', async () => {
    const runId = await canonicalRun();
    await recordPaperStrategySignals(runId);
    const now = new Date('2026-08-31T14:00:00.000Z');
    const quote = (ticker: string, price: number): YahooExecutionQuote => ({
      ticker,
      price,
      currency: 'USD',
      marketState: 'REGULAR',
      marketTime: '2026-08-31T13:59:00.000Z',
      source: 'yahoo',
      raw: { symbol: ticker, regularMarketPrice: price },
    });
    const quoteFetcher = async () => new Map([
      ['ELF', quote('ELF', 105)],
      ['SPY', quote('SPY', 500)],
    ]);

    const first = await executePendingPaperOrders({ now, quoteFetcher });
    const second = await executePendingPaperOrders({ now, quoteFetcher });
    expect(first).toEqual({
      pendingOrders: 4,
      filledOrders: 4,
      deferredOrders: 0,
      markedTickers: 2,
      reasons: {},
    });
    expect(second).toEqual({
      pendingOrders: 0,
      filledOrders: 0,
      deferredOrders: 0,
      markedTickers: 0,
      reasons: {},
    });

    const { rows } = await pool.query(
      `SELECT book_key, execution_price::text, executed_quantity::text,
              gross_usd::text, fee_usd::text
       FROM paper_strategy_orders ORDER BY id`,
    );
    expect(rows.every((row) => row.gross_usd === '100' && row.fee_usd === '0.1')).toBe(true);
    expect(rows.filter((row) => row.book_key === 'strategy')
      .every((row) => Number(row.executed_quantity) === 100 / 105)).toBe(true);
    expect(rows.filter((row) => row.book_key === 'benchmark')
      .every((row) => Number(row.executed_quantity) === 0.2)).toBe(true);

    const beforeRead = await pool.query(
      `SELECT (SELECT count(*)::int FROM paper_strategy_orders) AS orders,
              (SELECT count(*)::int FROM paper_strategy_marks) AS marks`,
    );
    const dashboard = await getPaperPerformanceDashboard(now);
    const afterRead = await pool.query(
      `SELECT (SELECT count(*)::int FROM paper_strategy_orders) AS orders,
              (SELECT count(*)::int FROM paper_strategy_marks) AS marks`,
    );
    expect(dashboard.available).toBe(true);
    expect(dashboard.books).toHaveLength(4);
    expect(dashboard.books.every((book) => book.investedUsd === 100.1)).toBe(true);
    expect(dashboard.books.every((book) => book.profitUsd != null
      && Math.abs(book.profitUsd + 0.1) < 1e-9)).toBe(true);
    expect(dashboard.recentOrders).toHaveLength(4);
    expect(dashboard.recentOrders.every((order) => order.evidence.state === 'captured')).toBe(true);
    expect(dashboard.recentOrders.every((order) => order.evidence.businessState === 'strong')).toBe(true);
    expect(dashboard.recentOrders.every((order) => order.evidence.marketSetupState === 'not_overheated')).toBe(true);
    expect(dashboard.recentOrders.every((order) => order.evidence.freshnessState === 'current_collection_confirmed')).toBe(true);
    expect(afterRead.rows[0]).toEqual(beforeRead.rows[0]);
  });

  it('leaves pending orders untouched when quotes are closed or stale', async () => {
    const runId = await canonicalRun();
    await recordPaperStrategySignals(runId);
    const result = await executePendingPaperOrders({
      now: new Date('2026-08-31T14:00:00.000Z'),
      quoteFetcher: async () => new Map([['ELF', {
        ticker: 'ELF', price: 105, currency: 'USD', marketState: 'CLOSED',
        marketTime: '2026-08-31T13:59:00.000Z', source: 'yahoo', raw: {},
      }], ['SPY', {
        ticker: 'SPY', price: 500, currency: 'USD', marketState: 'REGULAR',
        marketTime: '2026-08-31T12:00:00.000Z', source: 'yahoo', raw: {},
      }]]),
    });
    expect(result).toMatchObject({ pendingOrders: 4, filledOrders: 0, deferredOrders: 4 });
    expect(result.reasons).toEqual({
      ELF: 'US market is not in the regular trading session.',
      SPY: 'Execution quote timestamp is missing, in the future, or stale.',
    });
    const status = await pool.query(
      `SELECT status, count(*)::int AS count FROM paper_strategy_orders GROUP BY status`,
    );
    expect(status.rows).toEqual([{ status: 'pending', count: 4 }]);
  });

  it('never fills only one side of a strategy and SPY cash-flow pair', async () => {
    const runId = await canonicalRun();
    await recordPaperStrategySignals(runId);
    const now = new Date('2026-08-31T14:00:00.000Z');
    const quote = (ticker: string, price: number, marketTime: string): YahooExecutionQuote => ({
      ticker, price, currency: 'USD', marketState: 'REGULAR', marketTime,
      source: 'yahoo', raw: { symbol: ticker, regularMarketPrice: price },
    });

    const partial = await executePendingPaperOrders({
      now,
      quoteFetcher: async () => new Map([
        ['ELF', quote('ELF', 105, '2026-08-31T13:59:00.000Z')],
        ['SPY', quote('SPY', 500, '2026-08-31T12:00:00.000Z')],
      ]),
    });
    expect(partial).toMatchObject({ pendingOrders: 4, filledOrders: 0, deferredOrders: 4 });
    expect((await pool.query("SELECT count(*)::int AS count FROM paper_strategy_orders WHERE status='filled'"))
      .rows[0].count).toBe(0);

    const complete = await executePendingPaperOrders({
      now,
      quoteFetcher: async () => new Map([
        ['ELF', quote('ELF', 105, '2026-08-31T13:59:00.000Z')],
        ['SPY', quote('SPY', 500, '2026-08-31T13:59:00.000Z')],
      ]),
    });
    expect(complete).toMatchObject({ pendingOrders: 4, filledOrders: 4, deferredOrders: 0 });
  });

  it('creates paired exits only after three consecutive fresh fundamental failures', async () => {
    const initialRunId = await canonicalRun();
    await recordPaperStrategySignals(initialRunId);
    const quote = (ticker: string, price: number, marketTime: string): YahooExecutionQuote => ({
      ticker, price, currency: 'USD', marketState: 'REGULAR', marketTime,
      source: 'yahoo', raw: { symbol: ticker, regularMarketPrice: price },
    });
    await executePendingPaperOrders({
      now: new Date('2026-08-31T14:00:00.000Z'),
      quoteFetcher: async () => new Map([
        ['ELF', quote('ELF', 100, '2026-08-31T13:59:00.000Z')],
        ['SPY', quote('SPY', 500, '2026-08-31T13:59:00.000Z')],
      ]),
    });
    const companyId = Number((await pool.query("SELECT id FROM companies WHERE ticker = 'ELF'")).rows[0].id);

    const exitCounts: number[] = [];
    let lastRunId = 0;
    for (const [index, date] of ['2026-09-01', '2026-09-02', '2026-09-03'].entries()) {
      const collection = await startCollectionRun(`exit-${index}`);
      const priceId = await insertPriceSnapshot(companyId, 99 - index, `${date}T12:00:00.000Z`);
      await recordCollectionRunItem({
        collectionRunId: collection.id, ticker: 'ELF', lookupBucket: 'growth',
        selectedForMarketData: true, marketDataAttempted: true,
        marketDataFound: true, marketDataSource: 'yahoo', companyId,
      });
      await succeedCollectionRun(collection.id);
      const run = await recordDiscoveryRun(
        ['failed canonical fixture'],
        [makeDecisionInput({
          companyId, ticker: 'ELF', included: false, candidateRank: null,
          exclusionReasons: ['Growth below 65'], growthScore: 60,
          decisionPrice: 99 - index, priceSnapshotId: priceId,
        })],
        new Date(`${date}T12:00:00.000Z`),
        'rklb_daily',
        collection.id,
      );
      lastRunId = run.runId;
      exitCounts.push((await recordPaperStrategySignals(run.runId)).insertedExitOrders);
    }
    expect(exitCounts).toEqual([0, 0, 4]);

    const pendingSells = await pool.query(
      `SELECT strategy_key, book_key, side, status, requested_quantity
       FROM paper_strategy_orders WHERE run_id = $1 ORDER BY strategy_key, book_key`,
      [lastRunId],
    );
    expect(pendingSells.rows).toHaveLength(4);
    expect(pendingSells.rows.every((row) => row.side === 'sell' && row.status === 'pending')).toBe(true);

    await executePendingPaperOrders({
      now: new Date('2026-09-03T14:00:00.000Z'),
      quoteFetcher: async () => new Map([
        ['ELF', quote('ELF', 97, '2026-09-03T13:59:00.000Z')],
        ['SPY', quote('SPY', 510, '2026-09-03T13:59:00.000Z')],
      ]),
    });
    const open = await pool.query(
      `SELECT strategy_key, book_key,
              sum(CASE WHEN side = 'buy' THEN executed_quantity ELSE -executed_quantity END)::numeric AS quantity
       FROM paper_strategy_orders WHERE status = 'filled'
       GROUP BY strategy_key, book_key ORDER BY strategy_key, book_key`,
    );
    expect(open.rows.every((row) => Math.abs(Number(row.quantity)) < 1e-12)).toBe(true);
    const closed = (await getPaperPerformanceDashboard(new Date('2026-09-10T14:00:00Z'))).books
      .find((book) => book.strategy === 'entry_aware' && book.book === 'strategy')!;
    expect(closed.positions[0]).toMatchObject({ open: false, currentValueUsd: 0, latestPrice: null });
    expect(closed.positions[0].saleProceedsUsd).toBeCloseTo(96.9);
    expect(closed.positions[0].profitUsd).toBeCloseTo(-3.2);
    expect(closed.positions[0].profitUsd).toBeCloseTo(closed.profitUsd!);
  });
});
