import Link from 'next/link';
import { getNasdaqListings } from '@/lib/nasdaq-listings';
export default async function NasdaqListings() {
  const snapshot=await getNasdaqListings();
  const rows=snapshot?.rows??[];
  const priority=rows.filter(r=>r.analysis==='research').sort((a,b)=>(b.revenueGrowth??0)-(a.revenueGrowth??0)||a.ticker.localeCompare(b.ticker)).slice(0,5);
  return <section className="card" id="nasdaq-listings">
    <h2>New Nasdaq listings</h2>
    <p>Newly observed listings and announced additions, followed for 30 days. A trading-system addition is not proof of an IPO. Short trading history does not hide a company; missing evidence stays unknown.</p>
    {!snapshot?<p>Waiting for the first listing collection.</p>:<>
      <p>Observed {new Date(snapshot.observedAt).toLocaleString('en-GB',{timeZone:'Europe/Tallinn'})} Tallinn · {rows.length} observations · {snapshot.quoteAttempted} initial quote checks · {snapshot.quoteDeferred} deferred.</p>
      {snapshot.status==='failed'&&<p className="notice warning">{snapshot.error} Previous observations have not been presented as a fresh scan.</p>}
      {Date.now()-Date.parse(snapshot.observedAt)>36*3600000&&<p className="notice warning">Listing refresh is overdue. These are dated observations.</p>}
      {snapshot.baseline&&<p>First complete directory is the baseline. Existing directory members are not called new; dated Add announcements can still be observed.</p>}
      <p>Research shortlist: {priority.length} of up to 5 companies with at least 25% revenue growth and positive same-period USD operating cash flow. This is an unvalidated research filter, not a buy signal.</p>
      {priority.length===0&&<p>No listing currently has enough qualifying evidence for the shortlist.</p>}
      {priority.length>0&&<p>{priority.map(r=><span key={r.ticker}><Link href={`/company/${r.ticker}`}>{r.ticker}</Link>{' · '}</span>)}</p>}
      {rows.length===0&&snapshot.status==='ok'&&<p>No new listing or recent Nasdaq-primary Add was identified. Zero is a valid result.</p>}
      {rows.map(r=><article key={r.ticker}>
        <h3><Link href={`/company/${r.ticker}`}>{r.ticker}</Link> — {r.name}</h3>
        <p>{r.origin==='trading_add'?'Trading-system Add announcement':'Added since the previous complete directory'} · effective date {r.effectiveDate??'unknown'} · first observed {r.firstObservedAt}.</p>
        <p>{r.eligibility==='lookup_ready'?'Directory confirmed':r.eligibility==='radar_only'?'SPAC / blank-check: observation only':r.eligibility==='excluded'?'Excluded instrument or listing status':'Awaiting effective date / directory confirmation'} · {r.analysis==='research'?'Research further':r.analysis==='weak'?'Financial checks not met':'Financial assessment unknown'}.</p>
        <p>First observed USD price {r.firstPrice==null?'unavailable':`$${r.firstPrice.toFixed(2)}`} at {r.firstPriceAt??'unknown'}; received {r.priceObservedAt??'unknown'}. Scan price {r.price==null?'unavailable':`$${r.price.toFixed(2)}`} at {r.marketAt??'unknown'}.</p>
        <ul>{r.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
        {r.revenueGrowth!=null&&<p>Revenue growth {r.revenueGrowth.toFixed(1)}%.</p>}
        {r.facts.map(f=><p key={f.id}><a href={f.sourceUrl} target="_blank" rel="noreferrer">SEC {f.metric}: {f.value.toLocaleString('en-US')} {f.unit}</a> · {f.periodStart}–{f.periodEnd} · filed {f.filedAt}</p>)}
      </article>)}
      <details><summary>Sources and coverage</summary><p>Existing Nasdaq Trader directory/Adds-Deletes, Yahoo USD quotes and stored SEC CompanyFacts. Source file timestamp timezone is undeclared. Transfers, relistings and symbol changes can appear; IPO identity is not inferred. Financial enrichment shares the existing 20-company daily queue. Follow-up prices share the existing 50-symbol daily queue; coverage may be deferred. Discovery observations do not create paper orders or earned profit.</p>{snapshot.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">Nasdaq source</a> · file date {s.fileDate} · SHA256 {s.sha256}</p>)}</details>
    </>}
  </section>;
}
