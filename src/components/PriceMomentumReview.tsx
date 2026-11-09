import Link from 'next/link';
import type { PriceMomentumReview as Review } from '@/lib/price-momentum';
import type { measureGrowthCohort } from '@/lib/growth-cohort';
const percent = (n: number | null | undefined) => n == null ? 'Unknown' : n.toFixed(2) + '%';
export default function PriceMomentumReview({ scan, cohort }: { scan?: Review; cohort: ReturnType<typeof measureGrowthCohort> }) {
  const rows = scan?.rows ?? []; const candidates = rows.filter(r => r.state === 'observe');
  return <section className="card" id="price-momentum-review">
    <h2>Price momentum — independent of cash flow</h2>
    <p>Research candidates require positive known 1- and 3-month price returns. Negative or missing cash flow does not hide a price trend. These are speculative research observations; no news catalyst or future rise is established.</p>
    <p>History uses the existing shared 20 requests per collection, alternating fundamental-qualified and other valid radar names. Each queue checks never-attempted names first, then the oldest attempt. Current screenshots and past winners do not set priority.</p>
    {!scan ? <p>No frozen price-momentum scan yet. The next collection will record this version; old discoveries are not backfilled.</p> : <>
      <p>{candidates.length} candidates / {rows.length} observed names · {rows.filter(r => r.state === 'unknown').length} unknown · version {scan.version} · evaluated {scan.evaluatedAt}.</p>
      {Date.now() - Date.parse(scan.evaluatedAt) > 36 * 3600000 && <p className="notice warning">Scan refresh is overdue.</p>}
      <table><thead><tr><th>Stock</th><th>Observed USD price / time</th><th>1 month</th><th>3 months</th></tr></thead><tbody>
        {candidates.map(r => <tr key={r.ticker}><td><Link href={'/company/' + r.ticker}>{r.ticker}</Link></td><td>{r.price == null ? 'Unknown' : '$' + r.price.toFixed(2)} / {r.marketAt}</td><td>{percent(r.priceContext?.oneMonthReturnPercent)}</td><td>{percent(r.priceContext?.threeMonthReturnPercent)}</td></tr>)}
      </tbody></table>
      <p>Financial evidence and its exclusions remain visible in Growth opportunities. Price momentum does not override those checks or the capital risk stop.</p>
      <details><summary>All observations, missing evidence and exclusions</summary><ul>{rows.map(r => <li key={r.ticker}>{r.ticker}: {r.state}; 1m {percent(r.priceContext?.oneMonthReturnPercent)}, 3m {percent(r.priceContext?.threeMonthReturnPercent)}. {r.reasons.join(' ')} {r.priceObservations && <details><summary>Completed-day history inputs ({r.priceObservations.length})</summary><a href={'https://finance.yahoo.com/quote/' + r.ticker + '/history/'}>Yahoo history</a><ul>{r.priceObservations.map(p => <li key={p.capturedAt}>{p.capturedAt}: USD {p.price}</li>)}</ul></details>}</li>)}</ul></details>
    </>}
    <h3>Seven days after the first qualifying observation</h3>
    <p>Every first qualifying observation in this version stays in the denominator, including missing outcomes. Stored USD quote changes exclude costs and have unverified corporate actions. These are not trades, portfolio profit or proof of a profitable strategy.</p>
    {!cohort.rows.length ? <p>No frozen qualifying observations yet.</p> : <>
      <p>{cohort.rows.length} first observations · {cohort.rows.filter(r => r.priceChangePercent != null).length} measured · {cohort.rows.filter(r => r.status.endsWith('unavailable')).length} missing · {cohort.rows.filter(r => r.status === 'not_mature').length} pending.</p>
      <table><thead><tr><th>Stock</th><th>First qualification</th><th>First USD price</th><th>7-day quote change</th><th>Coverage</th></tr></thead><tbody>{cohort.rows.map(r => <tr key={r.ticker}><td>{r.ticker}</td><td>{r.firstObservedAt}</td><td>{r.firstPrice == null ? 'Unknown' : '$' + r.firstPrice.toFixed(2)}</td><td>{percent(r.priceChangePercent)}</td><td>{r.status}</td></tr>)}</tbody></table>
    </>}
  </section>;
}
