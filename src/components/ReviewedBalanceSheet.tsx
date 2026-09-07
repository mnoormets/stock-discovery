import { BALANCE_REVIEW_DATE, BALANCE_REVIEW_VERSION, getReviewedBalanceSheet, reconciliationTotals } from '@/lib/reviewed-balance-sheets';

const amount = (usd: number) => `$${(usd / 1_000_000).toFixed(3)}m`;

export default function ReviewedBalanceSheet({ ticker }: { ticker: string }) {
  const review = getReviewedBalanceSheet(ticker);
  if (!review) return null;
  const totals = reconciliationTotals(review);
  return <section className="card section">
    <p className="eyebrow">REVIEWED SEC FILING · {BALANCE_REVIEW_VERSION}</p>
    <h2>Debt and liquidity reconciliation</h2>
    <p>Balance sheet: {review.period} · Filed: {review.filed} · Reviewed: {BALANCE_REVIEW_DATE}.</p>
    <p className="muted">Dated manual review; does not update automatically. The CompanyFacts figures above may cover older periods. Review the next filing before using these amounts for a new decision.</p>
    <h3>Borrowings</h3>
    <table><thead><tr><th>Component</th><th>USD</th></tr></thead><tbody>
      {review.borrowingLines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{amount(line.usd)}</td></tr>)}
      <tr><th>Total borrowings</th><td>{amount(totals.borrowings)}</td></tr>
    </tbody></table>
    <h3>{ticker === 'API' ? 'Broad liquidity' : 'Cash'}</h3>
    <table><thead><tr><th>Component</th><th>USD</th></tr></thead><tbody>
      {review.liquidityLines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{amount(line.usd)}</td></tr>)}
      <tr><th>Total</th><td>{amount(totals.liquidity)}</td></tr>
      <tr><th>Less borrowings only</th><td>{amount(totals.difference)}</td></tr>
    </tbody></table>
    <h3>Separate items — not included in the difference above</h3>
    <table><thead><tr><th>Item</th><th>USD</th></tr></thead><tbody>
      {review.otherLines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{amount(line.usd)}</td></tr>)}
    </tbody></table>
    <p>{review.explanation}</p>
    {review.shares && <p>{review.shares}</p>}
    <p><a href={review.source} target="_blank" rel="noreferrer">SEC filing: balance sheet and supporting notes</a></p>
    <p className="muted">This reconciliation is not a fair-value estimate and does not replace saved scores or historical decisions.</p>
  </section>;
}
