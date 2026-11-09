import { getOpportunityQuoteNeeds, recordOpportunityPaper } from './opportunity-book';
import { hasReviewedTradingCessation } from './reviewed-trading-cessations';
import { pool } from './db';
import { fetchExecutionQuotes, type YahooExecutionQuote } from './yahoo';
import { isExpectedNewYorkRegularSession, newYorkPriceDate, priceObservationRecency } from './price-observation';

export const PRICE_TRACKING_DAILY_LIMIT = 50;
export const LISTING_SESSION_RESERVED_SLOTS = 10;
type TrackingCandidate = { company_id: string; ticker: string; reasons: string[]; last_attempt: Date | null };
/** Reserve existing capacity before open; capital quote coverage always wins. */
export function selectPriceTrackingBatch(queue: TrackingCandidate[], used: number, now: Date) {
  const available = Math.max(0, PRICE_TRACKING_DAILY_LIMIT - used);
  const critical = (row: TrackingCandidate) => row.ticker === 'SPY' || row.reasons.includes('capital holding');
  const listings = queue.filter(row => row.reasons.includes('new Nasdaq listing') && !critical(row))
    .sort((a,b)=>(a.last_attempt?.getTime()??0)-(b.last_attempt?.getTime()??0)||a.ticker.localeCompare(b.ticker));
  const listingNames = new Set(listings.map(row=>row.ticker));
  if (isExpectedNewYorkRegularSession(now)) {
    const priority = [...queue.filter(critical), ...listings.slice(0, LISTING_SESSION_RESERVED_SLOTS)];
    const names = new Set(priority.map(row=>row.ticker));
    return [...priority, ...queue.filter(row=>!names.has(row.ticker))].slice(0,available);
  }
  const day = newYorkPriceDate(now.toISOString())!;
  const localTime = new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const beforeOpen = localTime < '09:30';
  const hasSession = isExpectedNewYorkRegularSession(day+'T16:00:00Z');
  const reserve = beforeOpen && hasSession ? Math.min(LISTING_SESSION_RESERVED_SLOTS,listings.length) : 0;
  const capacity = Math.min(available,Math.max(queue.filter(critical).length,available-reserve));
  return queue.filter(row=>!listingNames.has(row.ticker)).slice(0,capacity);
}

type PriceTrackingCounts = { attempted:number; saved:number; unchanged:number; missing:number; stale:number;
  invalid:number; failed:number; deferred:number; previousErrors?:number };

export function priceTrackingHasErrors(counts: Pick<PriceTrackingCounts,'failed'|'missing'|'invalid'|'stale'|'previousErrors'>) {
  return !!(counts.failed || counts.missing || counts.invalid || counts.stale || counts.previousErrors);
}

export async function priceTrackingAvailable(): Promise<boolean> {
  return (await pool.query(`SELECT to_regclass('public.price_tracking_attempts') IS NOT NULL
    AND to_regclass('public.paper_capital_trades') IS NOT NULL AS available`)).rows[0].available;
}

/** Eligibility is separate from discovery selection and never creates items. */
export async function getPriceTrackingQueue(now = new Date()) {
  const result = await pool.query(`
    WITH growth_observations AS (
      SELECT r.id,r.finished_at,item,
        CASE WHEN pg_input_is_valid(r.metrics->'marketRadar'->'growth'->>'evaluatedAt','timestamptz')
          THEN (r.metrics->'marketRadar'->'growth'->>'evaluatedAt')::timestamptz END AS evaluated_at
      FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'growth'->'rows','[]'::jsonb)) item
      WHERE r.status='success' AND r.metrics->'marketRadar'->'growth'->>'version'='growth-opportunities-v2'
        AND r.finished_at <= $1
    ), growth_first AS (
      SELECT DISTINCT ON (item->>'ticker') * FROM growth_observations
      ORDER BY item->>'ticker',finished_at,id
    ), momentum_observations AS (
      SELECT r.id,r.finished_at,item,
        CASE WHEN pg_input_is_valid(r.metrics->'marketRadar'->'growth'->'priceMomentum'->>'evaluatedAt','timestamptz')
          THEN (r.metrics->'marketRadar'->'growth'->'priceMomentum'->>'evaluatedAt')::timestamptz END AS evaluated_at
      FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(r.metrics->'marketRadar'->'growth'->'priceMomentum'->'rows','[]'::jsonb)) item
      WHERE r.status='success' AND r.finished_at <= $1
        AND r.metrics->'marketRadar'->'growth'->'priceMomentum'->>'version'='price-momentum-review-v1'
        AND item->>'state'='observe'
    ), momentum_first AS (
      SELECT DISTINCT ON (item->>'ticker') * FROM momentum_observations WHERE evaluated_at <= finished_at
      ORDER BY item->>'ticker',finished_at,id
    ), reasons AS (
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
      SELECT c.id, 'capital holding' FROM companies c JOIN (
        SELECT instrument_ticker FROM paper_capital_trades WHERE executed_at <= $1
        GROUP BY policy_version,book_key,signal_ticker,instrument_ticker
        HAVING sum(CASE WHEN side='buy' THEN quantity ELSE -quantity END) > 1e-12
      ) h ON h.instrument_ticker=c.ticker
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
      SELECT c.id, 'growth opportunity' FROM growth_observations g
      JOIN companies c ON c.ticker=g.item->>'ticker'
      WHERE g.item->>'state' IN ('early','momentum') AND g.evaluated_at <= $1
        AND g.finished_at >= $1::timestamptz - interval '30 days'
      UNION
      SELECT c.id, 'growth cohort follow-up v1' FROM growth_first f
      JOIN companies c ON c.ticker=f.item->>'ticker'
      WHERE f.finished_at + interval '7 days' <= $1 AND f.finished_at + interval '10 days' >= $1
        AND f.evaluated_at <= f.finished_at
        AND CASE WHEN jsonb_typeof(f.item->'price')='number' THEN (f.item->>'price')::numeric > 0 ELSE false END
        AND CASE WHEN pg_input_is_valid(f.item->>'marketAt','timestamptz')
          THEN (f.item->>'marketAt')::timestamptz <= f.finished_at ELSE false END
        AND NOT EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id=c.id AND p.currency='USD'
          AND p.price > 0 AND p.market_at >= f.finished_at + interval '7 days'
          AND p.market_at <= f.finished_at + interval '10 days' AND p.market_at <= p.captured_at
          AND p.captured_at <= f.finished_at + interval '11 days' AND p.captured_at <= $1)
      UNION
      SELECT c.id, 'price momentum follow-up v1' FROM momentum_first f
      JOIN companies c ON c.ticker=f.item->>'ticker'
      WHERE f.finished_at + interval '7 days' <= $1 AND f.finished_at + interval '10 days' >= $1
        AND CASE WHEN jsonb_typeof(f.item->'price')='number' THEN (f.item->>'price')::numeric > 0 ELSE false END
        AND CASE WHEN pg_input_is_valid(f.item->>'marketAt','timestamptz')
          THEN (f.item->>'marketAt')::timestamptz <= f.finished_at ELSE false END
        AND NOT EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id=c.id AND p.currency='USD'
          AND p.price > 0 AND p.market_at >= f.finished_at + interval '7 days'
          AND p.market_at <= f.finished_at + interval '10 days' AND p.market_at <= p.captured_at
          AND p.captured_at <= f.finished_at + interval '11 days' AND p.captured_at <= $1)
      UNION
      SELECT c.id, 'unified opportunity quote v1' FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'opportunities'->'rows','[]'::jsonb)) item
      JOIN companies c ON c.ticker=item->>'ticker'
      WHERE r.status='success' AND r.finished_at<=$1 AND r.finished_at >= $1::timestamptz-interval '13 days'
        AND r.metrics->'opportunities'->>'version'='unified-opportunity-v1' AND item->>'state'='qualified_research'
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
    SELECT c.id AS company_id, c.ticker, c.sec_cik,
      EXISTS (SELECT 1 FROM portfolio_positions p WHERE p.ticker=c.ticker AND p.quantity>0 AND p.status IN ('active','watch')) AS has_portfolio_holding,
      array_agg(DISTINCT r.reason ORDER BY r.reason) AS reasons,
      (SELECT max(a.attempted_at) FROM price_tracking_attempts a WHERE a.company_id = c.id) AS last_attempt
    FROM reasons r JOIN companies c ON c.id = r.company_id
    LEFT JOIN growth_first f ON f.item->>'ticker'=c.ticker
    LEFT JOIN momentum_first m ON m.item->>'ticker'=c.ticker
    WHERE NOT EXISTS (SELECT 1 FROM price_tracking_attempts a WHERE a.company_id = c.id AND a.tracking_date = $2)
    GROUP BY c.id, c.ticker
    ORDER BY (c.ticker = 'SPY') DESC, bool_or(r.reason='capital holding') DESC,
      bool_or(r.reason='unified opportunity quote v1') DESC,
      bool_or(r.reason IN ('growth cohort follow-up v1','price momentum follow-up v1')) DESC,
      min(CASE WHEN r.reason='growth cohort follow-up v1' THEN f.finished_at WHEN r.reason='price momentum follow-up v1' THEN m.finished_at END) ASC NULLS LAST,
      bool_or(r.reason='paper holding') DESC, last_attempt ASC NULLS FIRST, c.ticker`,
  [now.toISOString(), newYorkPriceDate(now.toISOString())]);
  const rows = result.rows as { company_id:string; ticker:string; sec_cik:string|null; has_portfolio_holding:boolean; reasons:string[]; last_attempt:Date|null }[];
  if (rows.some(r=>r.reasons.includes('unified opportunity quote v1'))) {
    const needed=await getOpportunityQuoteNeeds(now);
    for(const r of rows)if(!needed.has(r.ticker))r.reasons=r.reasons.filter(x=>x!=='unified opportunity quote v1');
  }
  return rows.filter(row=>row.reasons.length>0 && (!hasReviewedTradingCessation(row.ticker,row.sec_cik,now)
    || row.has_portfolio_holding || row.reasons.includes('capital holding') || row.reasons.includes('paper holding')));
}

async function collectTrackedPricesCore(options: {
  now?: Date;
  quoteFetcher?: (tickers: string[]) => Promise<Map<string, YahooExecutionQuote>>;
} = {}) {
  if (!(await priceTrackingAvailable())) throw new Error('Price tracking requires migrations 0009 and 0011.');
  const now = options.now ?? new Date();
  const date = newYorkPriceDate(now.toISOString());
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('stock-discovery:price-tracking')) AS locked")).rows[0].locked;
    if (!locked) throw new Error('Price tracking is already running.');
    const budget = (await client.query(`SELECT count(*) AS used,
      count(*) FILTER (WHERE status IN ('failed','missing','invalid','stale')) AS previous_errors
      FROM price_tracking_attempts WHERE tracking_date=$1`,[date])).rows[0];
    const used = Number(budget.used);
    const queue = await getPriceTrackingQueue(now);
    const selected = selectPriceTrackingBatch(queue, used, now);
    const counts: PriceTrackingCounts = { attempted: 0, saved: 0, unchanged: 0, missing: 0, stale: 0, invalid: 0,
      failed: 0, deferred: queue.length - selected.length, previousErrors: Number(budget.previous_errors) };
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
        // Listing entry research needs a live session observation, not a prior close.
        if (status === 'saved' && item.reasons.includes('new Nasdaq listing')
          && !item.reasons.includes('capital holding') && item.ticker !== 'SPY'
          && (quote!.marketState !== 'REGULAR' || !isExpectedNewYorkRegularSession(quote!.marketTime!)
            || receivedAt.getTime() - Date.parse(quote!.marketTime!) > 20 * 60000)) status = 'stale';
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

export async function collectTrackedPrices(options: Parameters<typeof collectTrackedPricesCore>[0] = {}) {
  const result=await collectTrackedPricesCore(options);
  await recordOpportunityPaper(options.now);
  return result;
}
