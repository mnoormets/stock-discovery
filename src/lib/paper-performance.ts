import { pool } from './db';
import { PAPER_STRATEGY_POLICY_VERSION } from './config';
import { newYorkPriceDate, priceObservationRecency } from './price-observation';
import {
  PAPER_STRATEGY_SNAPSHOT_VERSION,
  type PaperBusinessState,
  type PaperFreshnessState,
  type PaperMarketSetupState,
  type PaperStrategyKey,
} from './paper-strategy';

export interface PaperSignalEvidence {
  state: 'captured' | 'unknown';
  version: string | null;
  businessState: PaperBusinessState | 'unknown';
  marketSetupState: PaperMarketSetupState;
  freshnessState: PaperFreshnessState | 'unknown';
  reasons: string[];
}

export interface PaperBookPerformance {
  strategy: PaperStrategyKey;
  book: 'strategy' | 'benchmark';
  filledOrders: number;
  pendingOrders: number;
  skippedOrders: number;
  investedUsd: number;
  saleProceedsUsd: number;
  currentValueUsd: number | null;
  profitUsd: number | null;
  returnPercent: number | null;
  openPositions: number;
  valuationComplete: boolean;
  valuationIssues: string[];
  oldestMarkAt: string | null;
  newestMarkAt: string | null;
}

export interface PaperPerformanceOrder {
  id: number;
  strategy: PaperStrategyKey;
  book: 'strategy' | 'benchmark';
  signalTicker: string;
  instrumentTicker: string;
  side: 'buy' | 'sell';
  status: 'pending' | 'filled' | 'skipped' | 'cancelled';
  signalAt: string;
  executedAt: string | null;
  executionPrice: number | null;
  executedQuantity: number | null;
  grossUsd: number | null;
  feeUsd: number | null;
  skipReason: string | null;
  evidence: PaperSignalEvidence;
}

export interface PaperPerformanceDashboard {
  available: boolean;
  policyVersion: string;
  generatedAt: string;
  books: PaperBookPerformance[];
  recentOrders: PaperPerformanceOrder[];
}

export type PaperBookStatus = 'no_positions' | 'pending' | 'valued' | 'valuation_incomplete';

export function getPaperBookStatus(book: Pick<PaperBookPerformance,
  'filledOrders' | 'pendingOrders' | 'valuationComplete'>): PaperBookStatus {
  if (book.filledOrders === 0) return book.pendingOrders > 0 ? 'pending' : 'no_positions';
  return book.valuationComplete ? 'valued' : 'valuation_incomplete';
}

function value(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableValue(input: unknown): number | null {
  if (input == null) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input != null && typeof input === 'object' && !Array.isArray(input);
}

/** Reads only the immutable V1 buy-signal snapshot and fails closed otherwise. */
export function parsePaperSignalEvidence(input: unknown): PaperSignalEvidence {
  const unknown: PaperSignalEvidence = {
    state: 'unknown',
    version: null,
    businessState: 'unknown',
    marketSetupState: 'unknown',
    freshnessState: 'unknown',
    reasons: [],
  };
  if (!isObject(input) || input.version !== PAPER_STRATEGY_SNAPSHOT_VERSION) return unknown;
  if (input.businessState !== 'strong' && input.businessState !== 'mixed') return unknown;
  if (!['not_overheated', 'overheated', 'unknown'].includes(String(input.marketSetupState))) return unknown;
  if (!['current_collection_confirmed', 'not_current_collection'].includes(String(input.freshnessState))) return unknown;
  if (!Array.isArray(input.reasons) || !input.reasons.every((reason) => typeof reason === 'string')) return unknown;
  return {
    state: 'captured',
    version: PAPER_STRATEGY_SNAPSHOT_VERSION,
    businessState: input.businessState,
    marketSetupState: input.marketSetupState as PaperMarketSetupState,
    freshnessState: input.freshnessState as PaperFreshnessState,
    reasons: input.reasons,
  };
}

export async function getPaperPerformanceDashboard(now = new Date()): Promise<PaperPerformanceDashboard> {
  const generatedAt = now.toISOString();
  const availability = await pool.query(
    "SELECT to_regclass('public.paper_strategy_orders') IS NOT NULL AS available",
  );
  if (!availability.rows[0]?.available) {
    return {
      available: false,
      policyVersion: PAPER_STRATEGY_POLICY_VERSION,
      generatedAt,
      books: [],
      recentOrders: [],
    };
  }

  const [ordersResult, marksResult] = await Promise.all([
    pool.query(
      `SELECT id, strategy_key, book_key, signal_ticker, instrument_ticker,
              side, status, signal_at, executed_at, execution_price,
              executed_quantity, gross_usd, fee_usd, skip_reason,
              eligibility_snapshot
       FROM paper_strategy_orders
       WHERE policy_version = $1
       ORDER BY signal_at DESC, id DESC`,
      [PAPER_STRATEGY_POLICY_VERSION],
    ),
    pool.query(
      `SELECT DISTINCT ON (ticker) ticker, price, currency, market_time
       FROM paper_strategy_marks
       ORDER BY ticker, market_time DESC, id DESC`,
    ),
  ]);
  const latestMarks = new Map(marksResult.rows.map((row) => [String(row.ticker), {
    price: nullableValue(row.price),
    currency: String(row.currency),
    marketTime: new Date(row.market_time).toISOString(),
  }]));
  const benchmarkMark = latestMarks.get('SPY');
  const validMark = (mark: typeof benchmarkMark) => mark != null && mark.price != null
    && mark.price > 0 && mark.currency === 'USD';
  const referenceAvailable = validMark(benchmarkMark)
    && priceObservationRecency(benchmarkMark!.marketTime, generatedAt) === 'recent';
  const keys: PaperStrategyKey[] = ['all_picks_baseline', 'entry_aware'];
  const books: PaperBookPerformance[] = [];

  for (const strategy of keys) {
    for (const book of ['strategy', 'benchmark'] as const) {
      const orders = ordersResult.rows.filter((row) => row.strategy_key === strategy && row.book_key === book);
      const filled = orders.filter((row) => row.status === 'filled');
      let investedUsd = 0;
      let saleProceedsUsd = 0;
      const positions = new Map<string, number>();
      for (const order of filled) {
        const quantity = value(order.executed_quantity);
        const gross = value(order.gross_usd);
        const fee = value(order.fee_usd);
        const ticker = String(order.instrument_ticker);
        if (order.side === 'buy') {
          investedUsd += gross + fee;
          positions.set(ticker, (positions.get(ticker) ?? 0) + quantity);
        } else {
          saleProceedsUsd += gross - fee;
          positions.set(ticker, (positions.get(ticker) ?? 0) - quantity);
        }
      }
      const open = [...positions.entries()].filter(([, quantity]) => quantity > 1e-12);
      const valuationIssues: string[] = [];
      if (open.length > 0 && !referenceAvailable) {
        valuationIssues.push('SPY: recent reference mark unavailable.');
      }
      for (const [ticker] of open) {
        const mark = latestMarks.get(ticker);
        if (!validMark(mark)) {
          valuationIssues.push(`${ticker}: valid USD mark missing.`);
        } else if (priceObservationRecency(mark!.marketTime, generatedAt) !== 'recent') {
          valuationIssues.push(`${ticker}: mark is stale or its timestamp is invalid.`);
        } else if (referenceAvailable && newYorkPriceDate(mark!.marketTime) !== newYorkPriceDate(benchmarkMark!.marketTime)) {
          valuationIssues.push(`${ticker}: mark date differs from SPY.`);
        } else if (referenceAvailable && Math.abs(new Date(mark!.marketTime).getTime()
          - new Date(benchmarkMark!.marketTime).getTime()) > 20 * 60_000) {
          valuationIssues.push(`${ticker}: mark time differs from SPY by more than 20 minutes.`);
        }
      }
      const valuationComplete = valuationIssues.length === 0;
      const currentValueUsd = filled.length === 0
        ? null
        : valuationComplete
          ? open.reduce((sum, [ticker, quantity]) => sum + quantity * latestMarks.get(ticker)!.price!, 0)
          : null;
      const profitUsd = currentValueUsd == null
        ? null
        : saleProceedsUsd + currentValueUsd - investedUsd;
      const returnPercent = profitUsd == null || investedUsd <= 0
        ? null
        : (profitUsd / investedUsd) * 100;
      const marks = open.flatMap(([ticker]) => {
        const mark = latestMarks.get(ticker);
        return mark ? [mark.marketTime] : [];
      }).sort();
      books.push({
        strategy,
        book,
        filledOrders: filled.length,
        pendingOrders: orders.filter((row) => row.status === 'pending').length,
        skippedOrders: orders.filter((row) => row.status === 'skipped').length,
        investedUsd,
        saleProceedsUsd,
        currentValueUsd,
        profitUsd,
        returnPercent,
        openPositions: open.length,
        valuationComplete,
        valuationIssues,
        oldestMarkAt: marks[0] ?? null,
        newestMarkAt: marks.at(-1) ?? null,
      });
    }
  }

  return {
    available: true,
    policyVersion: PAPER_STRATEGY_POLICY_VERSION,
    generatedAt,
    books,
    recentOrders: ordersResult.rows.slice(0, 50).map((row) => ({
      id: Number(row.id),
      strategy: row.strategy_key,
      book: row.book_key,
      signalTicker: String(row.signal_ticker),
      instrumentTicker: String(row.instrument_ticker),
      side: row.side,
      status: row.status,
      signalAt: new Date(row.signal_at).toISOString(),
      executedAt: row.executed_at ? new Date(row.executed_at).toISOString() : null,
      executionPrice: nullableValue(row.execution_price),
      executedQuantity: nullableValue(row.executed_quantity),
      grossUsd: nullableValue(row.gross_usd),
      feeUsd: nullableValue(row.fee_usd),
      skipReason: row.skip_reason || null,
      evidence: parsePaperSignalEvidence(row.eligibility_snapshot),
    })),
  };
}
