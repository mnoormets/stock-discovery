import YahooFinance from 'yahoo-finance2';
import { pool } from './db';
import { getAllStoredCompanyFinancials, type FinancialPoint } from './company-financials';
import { buildPriceContext } from './price-context';
import { newYorkPriceDate, priceObservationRecency } from './price-observation';
import type { EarlyHistory, EarlyOpportunity } from './early-opportunities';
import type { MarketRadarSnapshot, MarketRadarStock } from './market-radar';

export const GROWTH_OPPORTUNITY_VERSION = 'growth-opportunities-v2';
export const GROWTH_HISTORY_LIMIT = 20;
const DAY = 86400000;
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
export interface GrowthOpportunity extends Omit<EarlyOpportunity, 'state'> {
  state: 'early' | 'momentum' | 'excluded' | 'unknown';
}
export interface GrowthOpportunitySnapshot {
  version: typeof GROWTH_OPPORTUNITY_VERSION; evaluatedAt: string;
  historyAttempted: number; historyDeferred: number; rows: GrowthOpportunity[];
}
function known(point: FinancialPoint, clock: number) {
  const start = Date.parse(point.periodStart ?? '');
  const end = Date.parse(point.periodEnd); const filed = Date.parse(point.filedAt);
  return point.unit === 'USD' && point.periodKind !== 'instant' && Number.isFinite(point.value)
    && Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(filed)
    && start < end && end <= clock && filed <= clock && !!point.accessionNumber;
}
/** Select reporting periods, never the growth percentage or cash-flow sign. */
export function selectGrowthEvidence(points: FinancialPoint[], clock: Date): FinancialPoint[] {
  const usable = points.filter(p => known(p, clock.getTime()));
  const cash = usable.filter(p => p.metric === 'operating_cash_flow')
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.filedAt.localeCompare(a.filedAt) || (b.id ?? 0) - (a.id ?? 0))[0];
  if (!cash || clock.getTime() - Date.parse(cash.periodEnd) > 365 * DAY) return [];
  const revenue = usable.find(p => p.metric === 'revenue' && p.periodStart === cash.periodStart
    && p.periodEnd === cash.periodEnd && p.periodKind === cash.periodKind && p.accessionNumber === cash.accessionNumber);
  if (!revenue) return [];
  const duration = Date.parse(revenue.periodEnd) - Date.parse(revenue.periodStart!);
  const previous = usable.filter(p => p.metric === 'revenue' && p.periodKind === revenue.periodKind
      && p.accessionNumber === revenue.accessionNumber && Date.parse(p.periodEnd) < Date.parse(revenue.periodStart!)
      && Math.abs((Date.parse(revenue.periodEnd) - Date.parse(p.periodEnd)) / DAY - 365) <= 35
      && Math.abs((Date.parse(p.periodEnd) - Date.parse(p.periodStart!) - duration) / DAY) <= 20)
    .sort((a, b) => Math.abs((Date.parse(revenue.periodEnd) - Date.parse(a.periodEnd)) / DAY - 365)
      - Math.abs((Date.parse(revenue.periodEnd) - Date.parse(b.periodEnd)) / DAY - 365) || (b.id ?? 0) - (a.id ?? 0))[0];
  return previous ? [revenue, previous, cash] : [];
}
export function evaluateGrowthFundamentals(stock: MarketRadarStock, points: FinancialPoint[], now: Date): GrowthOpportunity {
  const row: GrowthOpportunity = { ticker: stock.ticker, name: stock.name, state: 'unknown', reasons: [],
    price: stock.price, marketAt: stock.marketAt, revenueGrowth: null, facts: [], priceContext: null };
  if (stock.price == null || !Number.isFinite(stock.price) || stock.price <= 0
    || stock.changePercent == null || !Number.isFinite(stock.changePercent)
    || priceObservationRecency(stock.marketAt, now.toISOString()) !== 'recent') {
    row.reasons.push('Current price/session change is unavailable or stale.'); return row;
  }
  // A filing received after the price observation cannot explain that observation.
  row.facts = selectGrowthEvidence(points, new Date(stock.marketAt!));
  if (row.facts.length !== 3) {
    row.reasons.push('Need recent USD revenue and operating cash flow with identical start/end, period kind and filing, plus comparable prior-year revenue in that filing.');
    return row;
  }
  const [revenue, previous, cash] = row.facts;
  if (previous.value <= 0 || revenue.value <= 0) {
    row.state = 'excluded'; row.reasons.push('Revenue comparison requires positive current and prior-year revenue.'); return row;
  }
  row.revenueGrowth = (revenue.value / previous.value - 1) * 100;
  row.reasons.push('Revenue grew ' + row.revenueGrowth.toFixed(1) + '% YoY; ' + revenue.periodKind
    + ' period ' + revenue.periodStart + ' to ' + revenue.periodEnd + '; OCF $' + cash.value.toLocaleString('en-US') + '. Same-filing evidence.');
  if (row.revenueGrowth < 25 || cash.value <= 0) {
    row.state = 'excluded'; row.reasons.push('Requires revenue growth >=25% and positive same-period operating cash flow.');
  }
  return row;
}
export function evaluateGrowthHistory(row: GrowthOpportunity, stock: MarketRadarStock, chart: EarlyHistory, now: Date): GrowthOpportunity {
  if (row.state !== 'unknown' || row.facts.length !== 3) return row;
  if (chart.meta.symbol !== row.ticker || chart.meta.currency !== 'USD' || chart.events?.splits?.length) {
    return { ...row, reasons: [...row.reasons, 'History identity/currency mismatch or split requires review.'] };
  }
  const cutoff = Date.parse(row.marketAt!); const quoteDay = newYorkPriceDate(row.marketAt!);
  // Yahoo stamps daily bars at market open. Never use that day's eventual close at an intraday signal.
  const observations = chart.quotes.flatMap(q => q.date instanceof Date && Number.isFinite(q.date.getTime())
    && q.date.getTime() <= Math.min(cutoff, now.getTime()) && q.date.getTime() >= cutoff - 200 * DAY
    && newYorkPriceDate(q.date.toISOString())! < quoteDay! && q.close != null && Number.isFinite(q.close) && q.close > 0
    ? [{ price: q.close, capturedAt: q.date.toISOString() }] : []);
  const context = buildPriceContext({ asOf: row.marketAt!, currentPrice: row.price, observations });
  let state: GrowthOpportunity['state'] = 'unknown'; let reason = 'Need known 1-, 3- and 6-month price references.';
  if ([context.oneMonthReturnPercent, context.threeMonthReturnPercent, context.sixMonthReturnPercent].every(v => v != null)) {
    if (!context.recentRunUp && stock.changePercent! < 5) {
      state = 'early'; reason = 'Before an elevated run-up under the original 20% / 35% / 50% reference thresholds.';
    } else if (context.recentRunUp && context.oneMonthReturnPercent! > 0 && context.threeMonthReturnPercent! > 0) {
      state = 'momentum'; reason = 'Already rising: positive 1- and 3-month returns with an elevated run-up. Continuation is unproven; reversal risk remains.';
    } else {
      state = 'excluded'; reason = 'Neither early setup nor positive 1- and 3-month momentum; session spike alone is insufficient.';
    }
  }
  return { ...row, state, priceContext: context, priceObservations: observations, reasons: [...row.reasons, reason] };
}
export async function collectGrowthOpportunities(radar: MarketRadarSnapshot, now = new Date(),
  financials?: Map<string, FinancialPoint[]>,
  chartFetcher: (ticker: string) => Promise<EarlyHistory> = ticker => yahoo.chart(ticker,
    { period1: new Date(now.getTime() - 200 * DAY), period2: now, interval: '1d', events: 'split' },
    { fetchOptions: { signal: AbortSignal.timeout(15000) } }),
): Promise<GrowthOpportunitySnapshot> {
  const facts = financials ?? new Map((await getAllStoredCompanyFinancials(true)).map(f => [f.ticker, f.facts ?? []]));
  const rows = radar.stocks.map(s => evaluateGrowthFundamentals(s, facts.get(s.ticker) ?? [], now));
  const eligible = rows.filter(r => r.state === 'unknown' && r.facts.length === 3);
  eligible.sort((a, b) => b.revenueGrowth! - a.revenueGrowth! || a.ticker.localeCompare(b.ticker));
  const selected = eligible.slice(0, GROWTH_HISTORY_LIMIT);
  for (const row of selected) {
    try { Object.assign(row, evaluateGrowthHistory(row, radar.stocks.find(s => s.ticker === row.ticker)!, await chartFetcher(row.ticker), now)); }
    catch { row.reasons.push('Yahoo history request failed; setup is unknown.'); }
  }
  for (const row of eligible.slice(GROWTH_HISTORY_LIMIT)) row.reasons.push('History deferred by the 20-symbol growth scan limit.');
  return { version: GROWTH_OPPORTUNITY_VERSION, evaluatedAt: new Date().toISOString(), historyAttempted: selected.length,
    historyDeferred: Math.max(0, eligible.length - selected.length), rows };
}
export async function getGrowthOpportunityHistory(now = new Date()) {
  const result = await pool.query(`WITH observations AS (
    SELECT r.id, r.metrics->'marketRadar'->'growth'->>'evaluatedAt' AS observed_at, item
    FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'growth'->'rows','[]'::jsonb)) item
    WHERE r.status='success' AND r.metrics->'marketRadar'->'growth'->>'version'=$1
      AND item->>'state' IN ('early','momentum') AND r.finished_at <= $2
      AND (r.metrics->'marketRadar'->'growth'->>'evaluatedAt')::timestamptz <= $2
  ), first_seen AS (
    SELECT DISTINCT ON (item->>'ticker',item->>'state') observed_at,item FROM observations
    ORDER BY item->>'ticker',item->>'state',observed_at,id
  ) SELECT f.*, p.price AS latest_price,p.market_at FROM first_seen f JOIN companies c ON c.ticker=f.item->>'ticker'
    LEFT JOIN LATERAL (SELECT price,market_at FROM price_snapshots WHERE company_id=c.id AND currency='USD'
      AND market_at >= (f.item->>'marketAt')::timestamptz AND market_at <= $2 AND captured_at <= $2
      AND captured_at >= f.observed_at::timestamptz ORDER BY market_at DESC,captured_at DESC LIMIT 1) p ON true
    ORDER BY observed_at DESC,f.item->>'ticker' LIMIT 100`, [GROWTH_OPPORTUNITY_VERSION, now.toISOString()]);
  return result.rows.map(r => {
    const row = r.item as GrowthOpportunity; const price = Number(r.latest_price);
    const marketAt = r.market_at?.toISOString() ?? null;
    const usable = r.latest_price != null && Number.isFinite(price) && price > 0 && row.price != null && row.price > 0
      && priceObservationRecency(marketAt, now.toISOString()) === 'recent';
    return { row, observedAt: r.observed_at as string, latestPrice: usable ? price : null, marketAt,
      returnPercent: usable ? (price / row.price! - 1) * 100 : null };
  });
}
