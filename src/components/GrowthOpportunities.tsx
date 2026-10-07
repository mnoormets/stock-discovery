import Link from 'next/link';
import { getMarketRadar } from '@/lib/market-radar';
import { getGrowthOpportunityHistory } from '@/lib/growth-opportunities';

export default async function GrowthOpportunities() {
  const [radar, history] = await Promise.all([getMarketRadar(), getGrowthOpportunityHistory()]);
  const scan = radar.snapshot?.growth;
  const candidates = scan?.rows.filter(r => r.state === 'early' || r.state === 'momentum') ?? [];
  return <section className="card" id="growth-opportunities">
    <h2>Growth opportunities — early setups and rising trends</h2>
    <p>Growing businesses can remain visible after a large price rise. Early and momentum are separate research hypotheses; neither predicts a future gain or triggers a paper purchase.</p>
    {!scan ? <p>The next collection will run the new growth scan. Existing early discoveries remain below.</p> : <>
      <p>{candidates.length} candidates from {scan.rows.length} radar stocks: {candidates.filter(r => r.state === 'early').length} early · {candidates.filter(r => r.state === 'momentum').length} momentum. History checked for {scan.historyAttempted}; {scan.historyDeferred} deferred. Evaluated {new Date(scan.evaluatedAt).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn.</p>
      <p>Rules: at least 25% revenue growth and positive USD operating cash flow with the same reporting period and filing. Momentum requires positive 1- and 3-month returns plus an elevated run-up. Sorting is by revenue growth, then ticker; up to 20 histories per collection. These thresholds are unvalidated.</p>
      {Date.now() - Date.parse(scan.evaluatedAt) > 36 * 3600000 && <p className="notice warning">Scan refresh is overdue; these are older observations.</p>}
      {!candidates.length && <p>No candidate passes the evidence checks in this collection.</p>}
      {candidates.map(row => <article key={row.ticker}>
        <h3><Link href={`/company/${row.ticker}`}>{row.ticker}</Link> — {row.name} · {row.state === 'momentum' ? 'Rising trend / reversal risk' : 'Early setup'}</h3>
        <p>Observed ${row.price!.toFixed(2)} at {row.marketAt}. Returns: 1m {row.priceContext!.oneMonthReturnPercent}% · 3m {row.priceContext!.threeMonthReturnPercent}% · 6m {row.priceContext!.sixMonthReturnPercent}%.</p>
        <ul>{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p>{row.facts.map(f => <span key={f.id}><a href={f.sourceUrl} target="_blank" rel="noreferrer">SEC {f.metric}: {f.value.toLocaleString('en-US')} {f.unit}, {f.periodStart}–{f.periodEnd}, filed {f.filedAt}</a>{' · '}</span>)}</p>
        <details><summary>Price history inputs ({row.priceObservations?.length ?? 0})</summary>
          <p><a href={`https://finance.yahoo.com/quote/${row.ticker}/history/`} target="_blank" rel="noreferrer">Yahoo daily history</a> · only completed days before the quote date; same-day closes are excluded.</p>
          <ul>{row.priceObservations?.map(p => <li key={p.capturedAt}>{p.capturedAt}: ${p.price.toFixed(4)}</li>)}</ul>
        </details>
      </article>)}
      <details><summary>Excluded / unknown ({scan.rows.length - candidates.length}) and their reasons</summary>
        <ul>{scan.rows.filter(r => r.state === 'excluded' || r.state === 'unknown').map(r => <li key={r.ticker}><Link href={`/company/${r.ticker}`}>{r.ticker}</Link> — {r.state}: {r.reasons.join(' ')}</li>)}</ul>
      </details>
    </>}
    <h3>Results after discovery — not purchased-position profit</h3>
    <p>Each category keeps its first actual discovery price and time. Follow-up quotes share the existing daily tracking budget. A historical price rise before discovery is never counted as our profit. Actual paper money made or lost is on <Link href="/performance">Performance</Link>.</p>
    {!history.length ? <p>No saved growth discoveries yet.</p> : <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Stock / setup</th><th>First discovery</th><th>Observed price</th><th>Latest usable price</th><th>Change since discovery</th></tr></thead><tbody>
      {history.map(item => <tr key={`${item.row.ticker}-${item.row.state}`}><td><Link href={`/company/${item.row.ticker}`}>{item.row.ticker}</Link> / {item.row.state}</td><td>{item.observedAt}</td><td>${item.row.price!.toFixed(2)}</td><td>{item.latestPrice == null ? 'Unknown' : `$${item.latestPrice.toFixed(2)} at ${item.marketAt}`}</td><td>{item.returnPercent == null ? 'Unknown' : `${item.returnPercent.toFixed(2)}%`}</td></tr>)}
    </tbody></table></div>}
    <small>growth-opportunities-v2 · Yahoo / SEC · separate from the existing paper entry policy</small>
  </section>;
}
