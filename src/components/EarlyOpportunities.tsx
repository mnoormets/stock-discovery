import Link from 'next/link';
import { getMarketRadar } from '@/lib/market-radar';
import { getEarlyOpportunityHistory } from '@/lib/early-opportunities';

export default async function EarlyOpportunities() {
  const [radar, history] = await Promise.all([getMarketRadar(), getEarlyOpportunityHistory()]);
  const scan = radar.snapshot?.early;
  const watch = scan?.rows.filter(row => row.state === 'watch') ?? [];
  return <section className="card" id="early-opportunities">
    <h2>Early opportunities — before an elevated run-up</h2>
    <p>Look for documented business growth while the observed price has not already made a large 1-, 3- or 6-month move. This is a research watchlist; future gains and losses are unknown.</p>
    {!scan ? <p>No early scan in the latest collection yet.</p> : <>
      <p>{watch.length} watch candidates from {scan.rows.length} radar stocks. History checked for {scan.historyAttempted}; {scan.historyDeferred} deferred. Evaluated {new Date(scan.evaluatedAt).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn.</p>
      <p>Rules: revenue growth at least 25% YoY, positive same-period USD operating cash flow, financial periods within 365 days, session gain below 5%, and known returns below +20% / +35% / +50% over 1 / 3 / 6 months. These initial thresholds are unvalidated research assumptions.</p>
      {Date.now() - Date.parse(scan.evaluatedAt) > 36 * 3600000 && <p className="notice warning">Scan refresh is overdue; these are older observations.</p>}
      {!watch.length && <p>No stock currently passes every check. Missing evidence does not count as an early opportunity.</p>}
      {watch.map(row => <article key={row.ticker}>
        <h3><Link href={`/company/${row.ticker}`}>{row.ticker}</Link> — {row.name}</h3>
        <p>Observed ${row.price!.toFixed(2)} at {row.marketAt}; revenue growth {row.revenueGrowth!.toFixed(1)}%. Returns: 1m {row.priceContext!.oneMonthReturnPercent}% · 3m {row.priceContext!.threeMonthReturnPercent}% · 6m {row.priceContext!.sixMonthReturnPercent}%.</p>
        <ul>{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p>{row.facts.map(f => <span key={f.id ?? f.metric}><a href={f.sourceUrl} target="_blank" rel="noreferrer">SEC {f.metric}: {f.value.toLocaleString('en-US')} {f.unit}, period {f.periodEnd}, filed {f.filedAt}</a>{' · '}</span>)}</p>
        <details><summary>Frozen Yahoo price history inputs ({row.priceObservations?.length ?? 0})</summary>
          <p><a href={`https://finance.yahoo.com/quote/${row.ticker}/history/`} target="_blank" rel="noreferrer">Yahoo historical prices</a> · chart close prices received during this scan; future observations excluded.</p>
          <ul>{row.priceObservations?.map(p => <li key={p.capturedAt}>{p.capturedAt}: ${p.price.toFixed(4)}</li>)}</ul>
        </details>
      </article>)}
      <details><summary>Excluded / unknown ({scan.rows.length - watch.length}) and their reasons</summary>
        <ul>{scan.rows.filter(row => row.state !== 'watch').map(row => <li key={row.ticker}><Link href={`/company/${row.ticker}`}>{row.ticker}</Link> — {row.state}: {row.reasons.join(' ')}</li>)}</ul>
      </details>
    </>}
    <h3>What happened after first early discovery?</h3>
    <p>First qualifying observation stays fixed. Price change is research performance from that observed price, not profit from a purchase. Names remain tracked for 30 days within the shared daily price budget; missing or stale marks stay unknown.</p>
    {!history.length ? <p>No qualifying discovery history yet.</p> : <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Stock</th><th>First early discovery</th><th>Observed price</th><th>Latest usable price</th><th>Change since discovery</th></tr></thead><tbody>
      {history.map(item => <tr key={item.row.ticker}><td><Link href={`/company/${item.row.ticker}`}>{item.row.ticker}</Link></td><td>{item.observedAt}</td><td>${item.row.price!.toFixed(2)}</td><td>{item.latestPrice == null ? 'Unknown' : `$${item.latestPrice.toFixed(2)} at ${item.marketAt}`}</td><td>{item.returnPercent == null ? 'Unknown' : `${item.returnPercent.toFixed(2)}%`}</td></tr>)}
    </tbody></table></div>}
    <small>Daily bounded Yahoo/SEC research · early-opportunities-v1 · research evidence for the separate capital paper entry checks</small>
  </section>;
}
