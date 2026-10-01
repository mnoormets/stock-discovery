import YahooFinance from 'yahoo-finance2';
import { pool } from './db';
import { getAllStoredCompanyFinancials, type CompanyFinancialSummary, type FinancialPoint } from './company-financials';
import { buildPriceContext, type CandidatePriceContext, type StoredPriceObservation } from './price-context';
import { priceObservationRecency } from './price-observation';
import type { MarketRadarSnapshot, MarketRadarStock } from './market-radar';

export const EARLY_OPPORTUNITY_VERSION = 'early-opportunities-v1';
export const EARLY_HISTORY_LIMIT = 20;
const DAY = 86400000;
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
export interface EarlyHistory {
  meta: { symbol: string; currency?: string }; events?: { splits?: unknown[] };
  quotes: Array<{ date: Date; close: number | null }>;
}
export interface EarlyOpportunity {
  ticker: string; name: string; state: 'watch' | 'excluded' | 'unknown'; reasons: string[];
  price: number | null; marketAt: string | null; revenueGrowth: number | null;
  facts: FinancialPoint[]; priceContext: CandidatePriceContext | null; priceObservations?: StoredPriceObservation[];
}
export interface EarlyOpportunitySnapshot {
  version: typeof EARLY_OPPORTUNITY_VERSION; evaluatedAt: string;
  historyAttempted: number; historyDeferred: number; rows: EarlyOpportunity[];
}
function knownFact(fact: FinancialPoint | undefined, now: Date): fact is FinancialPoint {
  if (!fact || !Number.isFinite(fact.value) || fact.unit !== 'USD') return false;
  const end = Date.parse(fact.periodEnd); const filed = Date.parse(fact.filedAt);
  return Number.isFinite(end) && Number.isFinite(filed) && end <= now.getTime()
    && filed <= now.getTime() && now.getTime() - end <= 365 * DAY;
}
export function evaluateEarlyFundamentals(stock: MarketRadarStock, financial: CompanyFinancialSummary | undefined, now: Date): EarlyOpportunity {
  const revenue = financial?.metrics.revenue;
  const cash = financial?.metrics.operating_cash_flow?.latest;
  const row: EarlyOpportunity = { ticker: stock.ticker, name: stock.name, state: 'unknown', reasons: [],
    price: stock.price, marketAt: stock.marketAt, revenueGrowth: revenue?.yearOverYearPercent ?? null, facts: [], priceContext: null };
  if (stock.price == null || priceObservationRecency(stock.marketAt, now.toISOString()) !== 'recent'
    || stock.changePercent == null) { row.reasons.push('Current price/session change is unavailable or stale.'); return row; }
  if (stock.changePercent >= 5) { row.state = 'excluded'; row.reasons.push('Session gain is already at least 5%.'); return row; }
  if (!knownFact(revenue?.latest, now) || !revenue?.previousComparable
    || !Number.isFinite(revenue.yearOverYearPercent) || !knownFact(cash, now)
    || !Number.isFinite(revenue.previousComparable.value) || revenue.previousComparable.value <= 0
    || !Number.isFinite(Date.parse(revenue.previousComparable.filedAt))
    || Date.parse(revenue.previousComparable.filedAt) > now.getTime()
    || revenue.latest.value <= 0 || revenue.previousComparable.periodKind !== revenue.latest.periodKind
    || Date.parse(revenue.previousComparable.periodEnd) >= Date.parse(revenue.latest.periodEnd)
    || cash.periodEnd !== revenue.latest.periodEnd || cash.periodKind !== revenue.latest.periodKind) {
    row.reasons.push('Need known, recent revenue growth and same-period USD operating cash flow.'); return row;
  }
  row.revenueGrowth = (revenue.latest.value / revenue.previousComparable.value - 1) * 100;
  row.facts = [revenue.latest, revenue.previousComparable, cash];
  if (row.revenueGrowth! < 25 || cash.value <= 0) {
    row.state = 'excluded'; row.reasons.push('Requires revenue growth >=25% and positive operating cash flow.'); return row;
  }
  row.reasons.push(`Revenue grew ${row.revenueGrowth!.toFixed(1)}% YoY; same-period operating cash flow is positive.`);
  return row;
}
export function evaluateEarlyHistory(row: EarlyOpportunity, chart: EarlyHistory, now: Date): EarlyOpportunity {
  if (chart.meta.symbol !== row.ticker || chart.meta.currency !== 'USD' || chart.events?.splits?.length) {
    return { ...row, state: 'unknown', reasons: [...row.reasons, 'History identity/currency mismatch or split requires review.'] };
  }
  const cutoff = Date.parse(row.marketAt!);
  const observations = chart.quotes.flatMap(q => q.date instanceof Date && Number.isFinite(q.date.getTime())
      && q.date.getTime() <= cutoff && q.date.getTime() <= now.getTime() && q.close != null && Number.isFinite(q.close) && q.close > 0
      ? [{ price: q.close, capturedAt: q.date.toISOString() }] : []).filter(q => Date.parse(q.capturedAt) >= cutoff - 200 * DAY);
  const context = buildPriceContext({ asOf: row.marketAt!, currentPrice: row.price, observations });
  const complete = [context.oneMonthReturnPercent, context.threeMonthReturnPercent, context.sixMonthReturnPercent].every(v => v != null);
  return { ...row, priceContext: context, priceObservations: observations, state: !complete ? 'unknown' : context.recentRunUp ? 'excluded' : 'watch',
    reasons: [...row.reasons, !complete ? 'Need 1-, 3- and 6-month price references; no early label from missing history.'
      : context.recentRunUp ? `Already elevated: ${context.recentRunUpReasons.join('; ')}`
        : 'Observed returns below +20% / +35% / +50% over 1 / 3 / 6 months. Future direction remains unknown.'] };
}
export async function collectEarlyOpportunities(radar: MarketRadarSnapshot, now = new Date()): Promise<EarlyOpportunitySnapshot> {
  const financials = new Map((await getAllStoredCompanyFinancials()).map(f => [f.ticker, f]));
  const rows = radar.stocks.map(stock => evaluateEarlyFundamentals(stock, financials.get(stock.ticker), now));
  const eligible = rows.filter(row => row.facts.length === 3 && row.state === 'unknown');
  // Prefer the largest documented revenue growth, then ticker. No opaque score.
  eligible.sort((a, b) => b.revenueGrowth! - a.revenueGrowth! || a.ticker.localeCompare(b.ticker));
  const selected = eligible.slice(0, EARLY_HISTORY_LIMIT);
  for (const row of selected) {
    try {
      const chart = await yahoo.chart(row.ticker, { period1: new Date(now.getTime() - 200 * DAY), period2: now, interval: '1d', events: 'split' },
        { fetchOptions: { signal: AbortSignal.timeout(15000) } });
      Object.assign(row, evaluateEarlyHistory(row, chart, now));
    } catch { row.reasons.push('Yahoo history request failed; early status is unknown.'); }
  }
  for (const row of eligible.slice(EARLY_HISTORY_LIMIT)) row.reasons.push('History deferred by the 20-symbol collection limit.');
  return { version: EARLY_OPPORTUNITY_VERSION, evaluatedAt: new Date().toISOString(),
    historyAttempted: selected.length, historyDeferred: Math.max(0, eligible.length - selected.length), rows };
}
export async function getEarlyOpportunityHistory(now = new Date()) {
  const result = await pool.query(`WITH observations AS (
    SELECT r.id, r.metrics->'marketRadar'->'early'->>'evaluatedAt' AS observed_at, row
    FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'early'->'rows','[]'::jsonb)) row
    WHERE r.status='success' AND r.metrics->'marketRadar'->'early'->>'version'=$1 AND row->>'state'='watch'
      AND r.finished_at <= $2
  ), first_seen AS (
    SELECT DISTINCT ON (row->>'ticker') row->>'ticker' AS ticker, observed_at, row
    FROM observations ORDER BY row->>'ticker', observed_at, id
  ) SELECT f.*, p.price AS latest_price, p.market_at, p.captured_at
    FROM first_seen f JOIN companies c ON c.ticker=f.ticker
    LEFT JOIN LATERAL (SELECT price, market_at, captured_at FROM price_snapshots
      WHERE company_id=c.id AND currency='USD' AND market_at >= (f.row->>'marketAt')::timestamptz
        AND market_at <= $2 AND captured_at <= $2 AND captured_at >= f.observed_at::timestamptz
      ORDER BY market_at DESC, captured_at DESC LIMIT 1) p ON true
    ORDER BY observed_at DESC, f.ticker LIMIT 100`, [EARLY_OPPORTUNITY_VERSION, now.toISOString()]);
  return result.rows.map(r => {
    const row = r.row as EarlyOpportunity; const price = Number(r.latest_price);
    const usable = r.latest_price != null && Number.isFinite(price) && price > 0 && row.price != null
      && priceObservationRecency(r.market_at?.toISOString() ?? null, now.toISOString()) === 'recent';
    return { row, observedAt: r.observed_at as string, latestPrice: usable ? price : null,
      marketAt: r.market_at?.toISOString() ?? null, returnPercent: usable ? (price / row.price! - 1) * 100 : null };
  });
}
