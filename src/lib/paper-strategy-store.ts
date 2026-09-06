import { pool } from './db';
import {
  PAPER_STRATEGY_EXIT_FAILURE_RUNS,
  PAPER_STRATEGY_ORDER_NOTIONAL_USD,
  PAPER_STRATEGY_POLICY_VERSION,
} from './config';
import { buildPriceContext } from './price-context';
import {
  assessPaperExecutionQuote,
  evaluatePaperStrategies,
  paperCommissionUsd,
  PAPER_STRATEGY_SNAPSHOT_VERSION,
  type PaperExecutionQuote,
  type PaperSignalEvaluation,
} from './paper-strategy';
import { fetchExecutionQuotes, type YahooExecutionQuote } from './yahoo';

interface CanonicalSignalRow {
  decision_id: string | number;
  ticker: string;
  growth_score: string | number | null;
  health_score: string | number | null;
  coverage_score: string | number;
  decision_price: string | number | null;
  price_snapshot_id: string | number | null;
  run_at: string | Date;
  collection_run_id: string | number | null;
  current_collection_confirmed: boolean;
}

export interface RecordPaperSignalsResult {
  runId: number;
  decisions: number;
  insertedOrders: number;
  existingOrders: number;
  pendingOrders: number;
  skippedOrders: number;
  insertedExitOrders: number;
}

export interface ExecutePaperOrdersResult {
  pendingOrders: number;
  filledOrders: number;
  deferredOrders: number;
  markedTickers: number;
  reasons: Record<string, string>;
}

export async function paperStrategySchemaAvailable(): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT to_regclass('public.paper_strategy_orders') IS NOT NULL AS available",
  );
  return Boolean(rows[0]?.available);
}

function numberOrNull(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function skipReason(evaluation: PaperSignalEvaluation): string | null {
  return evaluation.eligibility === 'skipped' ? evaluation.reasons.join(' ') : null;
}

async function recordExitSignals(
  client: import('pg').PoolClient,
  runId: number,
  runAt: Date,
): Promise<number> {
  const positions = await client.query(
    `SELECT strategy_key, book_key, signal_ticker, instrument_ticker,
            sum(CASE WHEN side = 'buy' THEN executed_quantity ELSE -executed_quantity END) AS open_quantity
     FROM paper_strategy_orders
     WHERE policy_version = $1 AND status = 'filled'
     GROUP BY strategy_key, book_key, signal_ticker, instrument_ticker
     HAVING sum(CASE WHEN side = 'buy' THEN executed_quantity ELSE -executed_quantity END) > 0
     ORDER BY strategy_key, signal_ticker, book_key`,
    [PAPER_STRATEGY_POLICY_VERSION],
  );
  let insertedExitOrders = 0;
  const assessed = new Map<string, { shouldExit: boolean; decisionId: number; price: number | null; priceSnapshotId: number | null; snapshot: object }>();

  for (const position of positions.rows) {
    const key = `${position.strategy_key}:${position.signal_ticker}`;
    let assessment = assessed.get(key);
    if (!assessment) {
      const history = await client.query(
        `SELECT d.id, d.growth_score, d.coverage_score, d.decision_price,
                d.price_snapshot_id, r.id AS run_id, r.run_at,
                COALESCE(cri.market_data_found, false) AS current_collection_confirmed
         FROM discovery_decisions d
         JOIN discovery_runs r ON r.id = d.run_id
         LEFT JOIN collection_run_items cri ON cri.id = d.collection_run_item_id
         WHERE r.run_type = 'rklb_daily' AND d.ticker = $1 AND r.run_at <= $2
         ORDER BY r.run_at DESC, r.id DESC
         LIMIT $3`,
        [position.signal_ticker, runAt.toISOString(), PAPER_STRATEGY_EXIT_FAILURE_RUNS],
      );
      const failures = history.rows.map((row) => ({
        runId: Number(row.run_id),
        decisionId: Number(row.id),
        currentCollectionConfirmed: Boolean(row.current_collection_confirmed),
        growthScore: numberOrNull(row.growth_score),
        coverageScore: Number(row.coverage_score),
        fundamentalFailure: numberOrNull(row.growth_score) == null
          || Number(row.growth_score) < 65
          || Number(row.coverage_score) < 70,
      }));
      const latest = history.rows[0];
      const shouldExit = failures.length === PAPER_STRATEGY_EXIT_FAILURE_RUNS
        && failures.every((item) => item.currentCollectionConfirmed && item.fundamentalFailure);
      assessment = {
        shouldExit,
        decisionId: latest ? Number(latest.id) : 0,
        price: latest ? numberOrNull(latest.decision_price) : null,
        priceSnapshotId: latest?.price_snapshot_id == null ? null : Number(latest.price_snapshot_id),
        snapshot: {
          version: 'paper-strategy-exit-v1',
          policyVersion: PAPER_STRATEGY_POLICY_VERSION,
          rule: `${PAPER_STRATEGY_EXIT_FAILURE_RUNS} consecutive current-collection-confirmed canonical evaluations with Growth < 65/missing or Coverage < 70`,
          shouldExit,
          evaluations: failures,
        },
      };
      assessed.set(key, assessment);
    }
    if (!assessment.shouldExit || assessment.decisionId <= 0) continue;

    const inserted = await client.query(
      `INSERT INTO paper_strategy_orders
        (policy_version, signal_snapshot_version, strategy_key, book_key,
         run_id, decision_id, signal_ticker, instrument_ticker, side, status,
         signal_at, signal_price, signal_price_snapshot_id,
         eligibility_snapshot, requested_quantity)
       VALUES ($1,'paper-strategy-exit-v1',$2,$3,$4,$5,$6,$7,'sell','pending',$8,$9,$10,$11::jsonb,$12)
       ON CONFLICT (policy_version, strategy_key, book_key, run_id, signal_ticker, side)
       DO NOTHING RETURNING id`,
      [
        PAPER_STRATEGY_POLICY_VERSION,
        position.strategy_key,
        position.book_key,
        runId,
        assessment.decisionId,
        position.signal_ticker,
        position.instrument_ticker,
        runAt.toISOString(),
        position.book_key === 'strategy' ? assessment.price : null,
        position.book_key === 'strategy' ? assessment.priceSnapshotId : null,
        JSON.stringify(assessment.snapshot),
        Number(position.open_quantity),
      ],
    );
    insertedExitOrders += inserted.rowCount ?? 0;
  }
  return insertedExitOrders;
}

/**
 * Freezes hypothetical buy intents from one already-recorded canonical run.
 * One candidate order and one same-cash-flow SPY order are inserted per policy.
 */
export async function recordPaperStrategySignals(runId: number): Promise<RecordPaperSignalsResult> {
  if (!Number.isInteger(runId) || runId <= 0) throw new Error('runId must be a positive integer.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query(
      `SELECT id, run_at, collection_run_id
       FROM discovery_runs
       WHERE id = $1 AND run_type = 'rklb_daily'
       FOR SHARE`,
      [runId],
    );
    if (!run.rows[0]) throw new Error(`Canonical discovery run ${runId} was not found.`);

    const decisions = await client.query<CanonicalSignalRow>(
      `SELECT d.id AS decision_id, d.ticker, d.growth_score, d.health_score,
              d.coverage_score, d.decision_price, d.price_snapshot_id,
              r.run_at, r.collection_run_id,
              COALESCE(cri.market_data_found, false) AS current_collection_confirmed
       FROM discovery_decisions d
       JOIN discovery_runs r ON r.id = d.run_id
       LEFT JOIN collection_run_items cri ON cri.id = d.collection_run_item_id
       WHERE d.run_id = $1 AND d.included = true
       ORDER BY d.candidate_rank NULLS LAST, d.ticker`,
      [runId],
    );

    let insertedOrders = 0;
    let pendingOrders = 0;
    let skippedOrders = 0;
    for (const row of decisions.rows) {
      const runAt = new Date(row.run_at);
      const observations = await client.query(
        `SELECT p.price, p.captured_at
         FROM price_snapshots p
         JOIN discovery_decisions d ON d.company_id = p.company_id
         WHERE d.id = $1 AND p.price IS NOT NULL AND p.captured_at <= $2
         ORDER BY p.captured_at, p.id`,
        [Number(row.decision_id), runAt.toISOString()],
      );
      const signalPrice = numberOrNull(row.decision_price);
      const priceContext = buildPriceContext({
        asOf: runAt,
        currentPrice: signalPrice,
        observations: observations.rows.map((item) => ({
          price: Number(item.price),
          capturedAt: new Date(item.captured_at).toISOString(),
        })),
      });
      const evaluations = evaluatePaperStrategies({
        ticker: row.ticker,
        canonicalIncluded: true,
        growthScore: numberOrNull(row.growth_score),
        healthScore: numberOrNull(row.health_score),
        coverageScore: Number(row.coverage_score),
        currentCollectionConfirmed: Boolean(row.current_collection_confirmed),
        priceContext,
      });

      for (const evaluation of evaluations) {
        for (const bookKey of ['strategy', 'benchmark'] as const) {
          const status = evaluation.eligibility === 'eligible' ? 'pending' : 'skipped';
          const inserted = await client.query(
            `INSERT INTO paper_strategy_orders
              (policy_version, signal_snapshot_version, strategy_key, book_key,
               run_id, decision_id, signal_ticker, instrument_ticker, side, status,
               signal_at, signal_price, signal_price_snapshot_id,
               eligibility_snapshot, skip_reason, notional_usd)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'buy',$9,$10,$11,$12,$13::jsonb,$14,$15)
             ON CONFLICT (policy_version, strategy_key, book_key, run_id, signal_ticker, side)
             DO NOTHING
             RETURNING id`,
            [
              PAPER_STRATEGY_POLICY_VERSION,
              PAPER_STRATEGY_SNAPSHOT_VERSION,
              evaluation.strategy,
              bookKey,
              runId,
              Number(row.decision_id),
              row.ticker,
              bookKey === 'benchmark' ? 'SPY' : row.ticker,
              status,
              runAt.toISOString(),
              bookKey === 'strategy' ? signalPrice : null,
              bookKey === 'strategy' && row.price_snapshot_id != null
                ? Number(row.price_snapshot_id)
                : null,
              JSON.stringify(evaluation),
              skipReason(evaluation),
              PAPER_STRATEGY_ORDER_NOTIONAL_USD,
            ],
          );
          if (inserted.rowCount) {
            insertedOrders += 1;
            if (status === 'pending') pendingOrders += 1;
            else skippedOrders += 1;
          }
        }
      }
    }
    const insertedExitOrders = await recordExitSignals(
      client,
      runId,
      new Date(run.rows[0].run_at),
    );
    await client.query('COMMIT');
    const expectedOrders = decisions.rows.length * 4;
    return {
      runId,
      decisions: decisions.rows.length,
      insertedOrders,
      existingOrders: expectedOrders - insertedOrders,
      pendingOrders,
      skippedOrders,
      insertedExitOrders,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

type QuoteFetcher = (tickers: string[]) => Promise<Map<string, YahooExecutionQuote>>;

/**
 * Fills only pending hypothetical orders with a fresh Yahoo REGULAR-session
 * quote. Repeated calls are idempotent because UPDATE requires status=pending.
 */
export async function executePendingPaperOrders(options: {
  now?: Date;
  quoteFetcher?: QuoteFetcher;
} = {}): Promise<ExecutePaperOrdersResult> {
  const now = options.now ?? new Date();
  const quoteFetcher = options.quoteFetcher ?? fetchExecutionQuotes;
  const pending = await pool.query(
    `SELECT id, instrument_ticker, side, notional_usd, requested_quantity
     FROM paper_strategy_orders
     WHERE status = 'pending'
     ORDER BY signal_at, id`,
  );
  const held = await pool.query(
    `SELECT instrument_ticker
     FROM paper_strategy_orders
     WHERE status = 'filled'
     GROUP BY policy_version, strategy_key, book_key, instrument_ticker
     HAVING sum(CASE WHEN side = 'buy' THEN executed_quantity ELSE -executed_quantity END) > 1e-12`,
  );
  // Marks must continue after a company leaves the daily shortlist. Net within
  // each book so a closed book cannot offset a holding in another strategy.
  const tickers = [...new Set([...pending.rows, ...held.rows]
    .map((row) => String(row.instrument_ticker)))].sort();
  const quotes = await quoteFetcher(tickers);
  const reasons: Record<string, string> = {};
  let filledOrders = 0;
  let markedTickers = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ticker of tickers) {
      const quote = quotes.get(ticker);
      const assessment = assessPaperExecutionQuote((quote ?? {
        price: null,
        currency: null,
        marketState: null,
        marketTime: null,
      }) satisfies PaperExecutionQuote, now);
      if (!quote || !assessment.executable) {
        reasons[ticker] = assessment.reason ?? 'Execution quote was not returned.';
        continue;
      }
      const mark = await client.query(
        `INSERT INTO paper_strategy_marks
          (ticker, price, currency, market_time, marked_at, source, quote_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (ticker, market_time, source) DO NOTHING
         RETURNING id`,
        [ticker, quote.price, quote.currency, quote.marketTime, now.toISOString(), quote.source, JSON.stringify(quote.raw)],
      );
      if (mark.rowCount) markedTickers += 1;
    }

    for (const order of pending.rows) {
      const ticker = String(order.instrument_ticker);
      const quote = quotes.get(ticker);
      const assessment = assessPaperExecutionQuote((quote ?? {
        price: null,
        currency: null,
        marketState: null,
        marketTime: null,
      }) satisfies PaperExecutionQuote, now);
      if (!quote || !assessment.executable || quote.price == null) continue;

      const isBuy = order.side === 'buy';
      const grossUsd = isBuy ? Number(order.notional_usd) : Number(order.requested_quantity) * quote.price;
      const quantity = isBuy ? grossUsd / quote.price : Number(order.requested_quantity);
      const feeUsd = paperCommissionUsd(grossUsd);
      const updated = await client.query(
        `UPDATE paper_strategy_orders
         SET status = 'filled', execution_price = $2, executed_quantity = $3,
             gross_usd = $4, fee_usd = $5, executed_at = $6,
             execution_market_time = $7, execution_source = $8,
             execution_quote = $9::jsonb, updated_at = $6
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [
          Number(order.id), quote.price, quantity, grossUsd, feeUsd,
          now.toISOString(), quote.marketTime, quote.source, JSON.stringify(quote.raw),
        ],
      );
      filledOrders += updated.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    pendingOrders: pending.rows.length,
    filledOrders,
    deferredOrders: pending.rows.length - filledOrders,
    markedTickers,
    reasons,
  };
}
