import { pool } from './db';
import { fetchExecutionQuotes, type YahooExecutionQuote } from './yahoo';
import { newYorkPriceDate, priceObservationRecency } from './price-observation';

export const PRICE_TRACKING_DAILY_LIMIT = 50;

export async function priceTrackingAvailable(): Promise<boolean> {
  return (await pool.query("SELECT to_regclass('public.price_tracking_attempts') IS NOT NULL AS available")).rows[0].available;
}

/** Eligibility is separate from discovery selection and never creates items. */
export async function getPriceTrackingQueue(now = new Date()) {
  const result = await pool.query(`
    WITH reasons AS (
      SELECT c.id AS company_id, 'active research' AS reason
      FROM companies c JOIN portfolio_positions p ON p.ticker = c.ticker
      WHERE p.status IN ('active', 'watch')
      UNION
      SELECT c.id, 'paper holding' FROM companies c JOIN (
        SELECT instrument_ticker FROM paper_strategy_orders WHERE status = 'filled'
        GROUP BY policy_version, strategy_key, book_key, instrument_ticker
        HAVING sum(CASE WHEN side = 'buy' THEN executed_quantity ELSE -executed_quantity END) > 1e-12
      ) h ON h.instrument_ticker = c.ticker
      UNION
      SELECT d.company_id, 'outcome horizon' FROM discovery_decisions d
      JOIN discovery_runs r ON r.id = d.run_id
      JOIN candidate_outcomes o ON o.decision_id = d.id
      WHERE r.run_type = 'rklb_daily' AND d.included AND d.decision_price > 0
        AND o.status <> 'measured' AND o.target_at + interval '7 days' > $1
      UNION
      SELECT c.id, 'early opportunity' FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'early'->'rows','[]'::jsonb)) item
      JOIN companies c ON c.ticker=item->>'ticker'
      WHERE r.status='success' AND r.metrics->'marketRadar'->'early'->>'version'='early-opportunities-v1'
        AND item->>'state'='watch' AND r.finished_at <= $1 AND r.finished_at >= $1::timestamptz - interval '30 days'
      UNION
      SELECT c.id, 'growth opportunity' FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'growth'->'rows','[]'::jsonb)) item
      JOIN companies c ON c.ticker=item->>'ticker'
      WHERE r.status='success' AND r.metrics->'marketRadar'->'growth'->>'version'='growth-opportunities-v2'
        AND item->>'state' IN ('early','momentum') AND r.finished_at <= $1
        AND (r.metrics->'marketRadar'->'growth'->>'evaluatedAt')::timestamptz <= $1
        AND r.finished_at >= $1::timestamptz - interval '30 days'
      UNION
      SELECT c.id, 'new Nasdaq listing' FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'nasdaqListings'->'rows','[]'::jsonb)) item
      JOIN companies c ON c.ticker=item->>'ticker'
      WHERE r.status='success' AND r.metrics->'nasdaqListings'->>'version'='nasdaq-listing-research-v1'
        AND item->>'eligibility'='lookup_ready' AND r.finished_at <= $1
        AND (item->>'firstObservedAt')::timestamptz >= $1::timestamptz - interval '30 days'
      UNION
      SELECT id, 'benchmark' FROM companies WHERE ticker = 'SPY'
    )
    SELECT c.id AS company_id, c.ticker, array_agg(DISTINCT r.reason ORDER BY r.reason) AS reasons,
      (SELECT max(a.attempted_at) FROM price_tracking_attempts a WHERE a.company_id = c.id) AS last_attempt
    FROM reasons r JOIN companies c ON c.id = r.company_id
    WHERE NOT EXISTS (SELECT 1 FROM price_tracking_attempts a WHERE a.company_id = c.id AND a.tracking_date = $2)
    GROUP BY c.id, c.ticker
    ORDER BY (c.ticker = 'SPY') DESC, last_attempt ASC NULLS FIRST, c.ticker`,
  [now.toISOString(), newYorkPriceDate(now.toISOString())]);
  return result.rows as { company_id: string; ticker: string; reasons: string[]; last_attempt: Date | null }[];
}

export async function collectTrackedPrices(options: {
  now?: Date;
  quoteFetcher?: (tickers: string[]) => Promise<Map<string, YahooExecutionQuote>>;
} = {}) {
  if (!(await priceTrackingAvailable())) throw new Error('Price tracking requires migration 0009.');
  const now = options.now ?? new Date();
  const date = newYorkPriceDate(now.toISOString());
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('stock-discovery:price-tracking')) AS locked")).rows[0].locked;
    if (!locked) throw new Error('Price tracking is already running.');
    const used = Number((await client.query('SELECT count(*) FROM price_tracking_attempts WHERE tracking_date = $1', [date])).rows[0].count);
    const queue = await getPriceTrackingQueue(now);
    const selected = queue.slice(0, Math.max(0, PRICE_TRACKING_DAILY_LIMIT - used));
    const counts = { attempted: 0, saved: 0, unchanged: 0, missing: 0, stale: 0, invalid: 0, failed: 0, deferred: queue.length - selected.length };
    for (let offset = 0; offset < selected.length; offset += 8) {
      if (offset > 0 && !options.quoteFetcher) await new Promise((resolve) => setTimeout(resolve, 1200));
      const batch = selected.slice(offset, offset + 8);
      let quotes = new Map<string, YahooExecutionQuote>();
      let failed = false;
      try { quotes = await (options.quoteFetcher ?? fetchExecutionQuotes)(batch.map((item) => item.ticker)); }
      catch { failed = true; }
      for (const item of batch) {
        const receivedAt = options.now ?? new Date();
        const quote = quotes.get(item.ticker);
        const recency = priceObservationRecency(quote?.marketTime ?? null, receivedAt.toISOString());
        let status: 'saved' | 'unchanged' | 'missing' | 'stale' | 'invalid' | 'failed' = failed ? 'failed'
          : !quote ? 'missing'
            : quote.ticker !== item.ticker || quote.price == null || !Number.isFinite(quote.price) || quote.price <= 0
              || quote.currency !== 'USD' || recency === 'unknown' ? 'invalid'
              : recency === 'stale' ? 'stale' : 'saved';
        let snapshotId: number | null = null;
        await client.query('BEGIN');
        try {
          if (status === 'saved') {
            const saved = await client.query(`INSERT INTO price_snapshots
              (company_id, captured_at, market_at, price, currency, market_cap, volume, source)
              VALUES ($1, $2, $3, $4, $5, $6, $7, 'yahoo-tracking-v1')
              ON CONFLICT DO NOTHING RETURNING id`, [item.company_id, receivedAt.toISOString(), quote!.marketTime,
              quote!.price, quote!.currency, quote!.raw.marketCap ?? null, quote!.raw.regularMarketVolume ?? null]);
            snapshotId = saved.rows[0] ? Number(saved.rows[0].id) : null;
            if (snapshotId == null) {
              status = 'unchanged';
              const existing = await client.query(`SELECT id FROM price_snapshots WHERE company_id = $1
                AND market_at = $2 AND source = 'yahoo-tracking-v1'`, [item.company_id, quote!.marketTime]);
              snapshotId = existing.rows[0] ? Number(existing.rows[0].id) : null;
            }
          }
          await client.query(`INSERT INTO price_tracking_attempts
            (tracking_date, company_id, ticker, attempted_at, reasons, status, market_at, price_snapshot_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [date, item.company_id, item.ticker, receivedAt.toISOString(), item.reasons,
            status, quote?.marketTime && newYorkPriceDate(quote.marketTime) ? quote.marketTime : null, snapshotId]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        counts.attempted += 1;
        counts[status] += 1;
      }
    }
    return counts;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('stock-discovery:price-tracking'))");
    client.release();
  }
}

export async function getPriceTrackingSummary() {
  if (!(await priceTrackingAvailable())) return { available: false, waiting: 0, rows: [] };
  const result = await pool.query(`SELECT ticker, status, attempted_at, market_at, reasons
    FROM price_tracking_attempts WHERE tracking_date = (SELECT max(tracking_date) FROM price_tracking_attempts)
    ORDER BY ticker`);
  return { available: true, waiting: (await getPriceTrackingQueue()).length,
    rows: result.rows as { ticker: string; status: string; attempted_at: Date; market_at: Date | null; reasons: string[] }[] };
}
