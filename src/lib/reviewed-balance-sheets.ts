// Manually reconciled SEC filings. Keep dated versions; these records are not
// CompanyFacts aliases and must never silently replace automated score inputs.
export const BALANCE_REVIEW_VERSION = 'balance-review-2026-09-07';
export const BALANCE_REVIEW_DATE = '2026-09-07';

type Amount = { label: string; usd: number };
export interface ReviewedBalanceSheet {
  ticker: string;
  period: string;
  filed: string;
  source: string;
  borrowingLines: Amount[];
  liquidityLines: Amount[];
  otherLines: Amount[];
  explanation: string;
  shares?: string;
}

const reviews: ReviewedBalanceSheet[] = [
  {
    ticker: 'BW', period: '2026-06-30', filed: '2026-08-10',
    source: 'https://www.sec.gov/Archives/edgar/data/1630805/000163080526000068/bw-20260630.htm',
    borrowingLines: [
      { label: 'Current senior notes, carrying value', usd: 61_369_000 },
      { label: 'Current borrowings', usd: 151_000 },
      { label: 'Noncurrent borrowings', usd: 67_416_000 },
      { label: '2030 senior notes, carrying value', usd: 147_907_000 },
    ],
    liquidityLines: [{ label: 'Cash and cash equivalents', usd: 308_634_000 }],
    otherLines: [
      { label: 'Restricted cash — excluded from available cash', usd: 74_196_000 },
      { label: 'Preferred stock — reported gross amount, rounded', usd: 191_700_000 },
      { label: 'Finance leases (current + noncurrent)', usd: 2_040_000 + 25_782_000 },
      { label: 'Operating leases (current + noncurrent)', usd: 3_598_000 + 14_025_000 },
      { label: 'All liabilities — includes borrowings; do not add again', usd: 942_234_000 },
    ],
    explanation: 'Borrowings reconcile to the reported $276.8m total. Carrying values include $23.668m premium on the 2030 notes and financing-cost deductions. Preferred stock and leases are separate claims. Cash minus borrowings alone does not establish surplus value for common shareholders; pension, warrant and operating obligations also matter.',
  },
  {
    ticker: 'API', period: '2026-06-30', filed: '2026-08-14',
    source: 'https://www.sec.gov/Archives/edgar/data/1802883/000119312526350691/api-ex99_1.htm',
    borrowingLines: [
      { label: 'Short-term borrowings', usd: 1_330_000 },
      { label: 'Headquarters project borrowings', usd: 98_986_000 },
    ],
    liquidityLines: [
      { label: 'Cash and cash equivalents', usd: 72_667_000 },
      { label: 'Short-term bank deposits', usd: 215_988_000 },
      { label: 'Short-term bank products', usd: 52_000_000 },
      { label: 'Long-term bank deposits', usd: 21_000_000 },
    ],
    otherLines: [
      { label: 'Restricted cash — excluded from broad liquidity', usd: 200_000 },
      { label: 'Short-term investments — excluded from broad liquidity', usd: 3_181_000 },
      { label: 'Operating leases (current + noncurrent)', usd: 947_000 + 138_000 },
      { label: 'Construction payables', usd: 17_340_000 },
      { label: 'Headquarters project advance', usd: 21_292_000 },
    ],
    explanation: 'Broad liquidity reconciles to the reported $361.7m. It includes deposits and bank products, not just immediately spendable cash. The difference after borrowings is not distributable cash or an enterprise-value adjustment: maturity, access, operating needs and project commitments still matter.',
    shares: '1 ADS = 4 Class A ordinary shares. The filing reports approximately 335.1m ordinary shares / 83.8m ADS equivalents at June 30. Q2 weighted-average diluted ADSs: 92,384,656; this earnings denominator is not the period-end share count.',
  },
];

export function getReviewedBalanceSheet(ticker: string): ReviewedBalanceSheet | null {
  return reviews.find((review) => review.ticker === ticker.toUpperCase()) ?? null;
}

export function reconciliationTotals(review: ReviewedBalanceSheet) {
  const borrowings = review.borrowingLines.reduce((sum, line) => sum + line.usd, 0);
  const liquidity = review.liquidityLines.reduce((sum, line) => sum + line.usd, 0);
  return { borrowings, liquidity, difference: liquidity - borrowings };
}
