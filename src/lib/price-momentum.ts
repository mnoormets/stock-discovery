import { buildPriceContext, type CandidatePriceContext } from './price-context';
import { newYorkPriceDate, priceObservationRecency } from './price-observation';
import type { MarketRadarStock } from './market-radar';
import type { EarlyHistory } from './early-opportunities';
export const PRICE_MOMENTUM_VERSION = 'price-momentum-review-v1';
export interface PriceMomentumRow {
  ticker: string; name: string; state: 'observe' | 'declining_or_flat' | 'unknown';
  price: number | null; marketAt: string | null; priceContext: CandidatePriceContext | null;
  reasons: string[]; historyAttempted: boolean;
  priceObservations?: Array<{ price: number; capturedAt: string }>;
}
export interface PriceMomentumReview {
  version: typeof PRICE_MOMENTUM_VERSION; evaluatedAt: string; rows: PriceMomentumRow[];
}
export function usableMomentumQuote(stock: MarketRadarStock, now: Date): boolean {
  return stock.price != null && Number.isFinite(stock.price) && stock.price > 0
    && stock.marketAt != null && Date.parse(stock.marketAt) <= now.getTime()
    && priceObservationRecency(stock.marketAt, now.toISOString()) === 'recent';
}
export function evaluatePriceMomentum(stock: MarketRadarStock, chart: EarlyHistory | null, now: Date): PriceMomentumRow {
  const row: PriceMomentumRow = { ticker: stock.ticker, name: stock.name, state: 'unknown',
    price: stock.price, marketAt: stock.marketAt, priceContext: null, reasons: [], historyAttempted: chart != null };
  if (!usableMomentumQuote(stock, now)) { row.reasons.push('Current USD quote missing, future-dated or stale.'); return row; }
  if (!chart) { row.reasons.push('History unavailable or deferred within the shared 20-history budget.'); return row; }
  if (chart.meta.symbol !== stock.ticker || chart.meta.currency !== 'USD' || chart.events?.splits?.length) {
    row.reasons.push('History identity/currency mismatch or split requires review.'); return row;
  }
  const cutoff = Date.parse(stock.marketAt!); const day = newYorkPriceDate(stock.marketAt!);
  const observations = chart.quotes.flatMap(q => q.date instanceof Date && Number.isFinite(q.date.getTime())
    && q.date.getTime() <= Math.min(cutoff, now.getTime()) && q.date.getTime() >= cutoff - 200 * 86400000
    && newYorkPriceDate(q.date.toISOString())! < day! && q.close != null && Number.isFinite(q.close) && q.close > 0
    ? [{ price: q.close, capturedAt: q.date.toISOString() }] : []);
  row.priceObservations = observations;
  row.priceContext = buildPriceContext({ asOf: stock.marketAt!, currentPrice: stock.price, observations });
  const one = row.priceContext.oneMonthReturnPercent, three = row.priceContext.threeMonthReturnPercent;
  if (one == null || three == null) row.reasons.push('Need completed prior-day 1- and 3-month price references.');
  else { row.state = one > 0 && three > 0 ? 'observe' : 'declining_or_flat';
    row.reasons.push(row.state === 'observe' ? 'Positive known 1- and 3-month returns; continuation unproven.' : 'At least one reference return is flat or falling.'); }
  return row;
}
