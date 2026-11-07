import Link from 'next/link';
import { getListingEntryEvaluation } from '@/lib/listing-entry-evaluation';
export default async function ListingEntryEvaluation() {
  const report=await getListingEntryEvaluation();
  return <section className="card" id="listing-entry-evaluation">
    <h2>New-listing entry evaluation</h2>
    <p>Can a fresh entry after discovery lead to a gain? This unfunded test measures individual $1,000 quote scenarios, not portfolio earnings or filled trades.</p>
    <p>Rules frozen {report.rules.registeredAt}: entry strictly after first directory-confirmed discovery, within 3 elapsed days; USD regular-session quote received within 20 minutes. Exit after 7 elapsed days, with 3 days of grace. Costs: $1 per side plus 5 basis points of slippage per side; fractional shares. Later financial updates do not change the first-discovery filter.</p>
    <p>Only discoveries after the rules were frozen count as prospective. Earlier examples are retrospective. IPO identity and corporate actions are unverified; dividends, taxes and FX are excluded. These results do not count toward the capital experiment.</p>
    <table><thead><tr><th>Sample</th><th>Filter at discovery</th><th>Names</th><th>Complete</th><th>Missing</th><th>Pending</th><th>Mean modeled net / $1,000</th></tr></thead>
      <tbody>{report.groups.map(g=><tr key={g.phase+g.arm}><td>{g.phase}</td><td>{g.arm==='all_confirmed'?'All confirmed listings':'Financial checks passed'}</td><td>{g.total}</td><td>{g.completeScenarios}</td><td>{g.missing}</td><td>{g.pending}</td><td>{g.meanModeledNetUSD==null?'Unknown':`$${g.meanModeledNetUSD.toFixed(2)}`}</td></tr>)}</tbody></table>
    {!report.groups.some(g=>g.phase==='prospective'&&g.completeScenarios>0)&&<p>No complete prospective entry/exit pair yet. Missing quotes are not counted as zero returns.</p>}
    <details><summary>Entry and exit evidence ({report.rows.length} names)</summary>{report.rows.map(r=><article key={r.ticker}>
      <h3><Link href={`/company/${r.ticker}`}>{r.ticker}</Link></h3>
      <p>{r.prospective?'Prospective':'Retrospective'} · first eligible collection {r.collectionId} · discovered {r.discoveredAt} · {r.status.replaceAll('_',' ')}.</p>
      <p>Entry {r.entry?`$${r.entry.price!.toFixed(2)} at ${r.entry.marketAt}; received ${r.entry.capturedAt}; quote ${r.entry.id}`:'unavailable'}.</p>
      <p>Exit {r.exit?`$${r.exit.price!.toFixed(2)} at ${r.exit.marketAt}; received ${r.exit.capturedAt}; quote ${r.exit.id}`:'unavailable'}.</p>
      {r.modeledNetUSD!=null&&<p>Modeled net ${r.modeledNetUSD.toFixed(2)} after costs; corporate actions unverified.</p>}
    </article>)}</details>
    <p>Evaluated {report.asOf} · {report.version}. Stored Nasdaq observations and USD price snapshots only; this view makes no market requests or orders.</p>
  </section>;
}
