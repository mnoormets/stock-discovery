import YahooFinance from 'yahoo-finance2';
import type { EarlyHistory } from './early-opportunities';

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
export type CapitalHolding = { ticker: string; boughtAt: Date };
export type CapitalSplitCheck = { ticker: string; issue: string | null };
export function capitalSplitIssue(ticker: string, chart: EarlyHistory, start: Date, now: Date): string | null {
  if (chart.meta.symbol !== ticker || chart.meta.currency !== 'USD' || !chart.quotes.some(q => q.date instanceof Date && Number.isFinite(q.date.getTime())
    && q.date >= start && q.date <= now && q.close != null && Number.isFinite(q.close) && q.close > 0))
    return 'Split history identity, currency or prices unavailable.';
  if (chart.events?.splits?.length) return 'Split since entry requires quantity reconciliation.';
  return null;
}
export async function checkCapitalSplits(holdings: CapitalHolding[], now: Date): Promise<CapitalSplitCheck[]> {
  const first = new Map<string, Date>();
  for (const holding of holdings) {
    const previous = first.get(holding.ticker);
    if (!previous || holding.boughtAt < previous) first.set(holding.ticker, holding.boughtAt);
  }
  return Promise.all([...first].map(async ([ticker, boughtAt]) => {
    // Include entry-day events conservatively; share quantities are never rewritten here.
    const period1 = new Date(boughtAt); period1.setUTCHours(0,0,0,0);
    try {
      const chart = await yahoo.chart(ticker, { period1, period2: now, interval: '1d', events: 'split' },
        { fetchOptions: { signal: AbortSignal.timeout(15000) } });
      return { ticker, issue: capitalSplitIssue(ticker, chart, period1, now) };
    } catch { return { ticker, issue: 'Yahoo split history unavailable; quantity integrity unknown.' }; }
  }));
}
