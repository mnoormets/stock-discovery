import { pool } from '@/lib/db';
import type { DiscoveryEvidence as Snapshot } from '@/lib/discovery-evidence';
export default async function DiscoveryEvidence() {
  const result=(await pool.query("SELECT metrics->'discoveryEvidence' evidence FROM collection_runs ORDER BY id DESC LIMIT 1")).rows[0];
  const scan=result?.evidence as Snapshot|undefined;
  const ciks=[...new Set((scan?.filings??[]).map(f=>f.cik.replace(/^0+/,'')))];
  const stored=ciks.length?(await pool.query("SELECT c.ticker,ltrim(c.sec_cik,'0') cik,max(f.filed_at)::text filed_at FROM companies c LEFT JOIN financial_facts f ON f.company_id=c.id WHERE ltrim(c.sec_cik,'0')=ANY($1::text[]) GROUP BY c.id",[ciks])).rows:[];
  const gaps=stored.flatMap(r=>{const latest=scan!.filings.filter(f=>f.cik.replace(/^0+/,'')===r.cik).map(f=>f.filedAt).sort().at(-1)!;return !r.filed_at||latest>r.filed_at?[{ticker:r.ticker,latest,stored:r.filed_at}]:[];});
  return <section className="card" id="discovery-evidence"><h2>Active web searches and filing updates</h2>
    <p>Queries search public financial news and the web; official SEC filings supply a separate issuer-wide update stream. These are source observations, not confirmed positive catalysts or forecasts. Coverage is bounded and failures stay visible.</p>
    {!scan?<p>No frozen multi-source discovery snapshot yet.</p>:<>
      <p>Observed {scan.observedAt}. Issuer inventory: {scan.universeSize} exchange-listed ticker records ({scan.universeStatus}); this is not a count of fully analysed common stocks. {scan.web.length} retained web observations · {scan.web.filter(w=>w.tickers.length).length} linked to issuers · {scan.filings.length} retained filings / {scan.filingsBeforeLimit} before the limit.</p>
      <p>Initial source quote checks: up to 10 names per collection, never/oldest attempted first. Existing 20 history and shared daily 20 financial / 50 follow-up limits remain. Unknown identity or security type is not a capital buy signal.</p>
      <details open><summary>Searches, source status and provenance</summary><ul>{scan.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.query}</a> — {s.kind}: {s.status}, {s.accepted} accepted / {s.received} received; observed {s.observedAt}; SHA256 {s.sha256??'unavailable'}</li>)}</ul></details>
      <h3>Newer financial reports awaiting stored facts</h3>
      <p>{gaps.length} known issuers have a newer observed financial filing than their stored facts. They receive refresh priority within the shared budget; a notice does not mean its numbers are already imported.</p>
      <table><thead><tr><th>Stock</th><th>Latest observed filing</th><th>Latest stored filing</th></tr></thead><tbody>{gaps.slice(0,40).map(g=><tr key={g.ticker}><td>{g.ticker}</td><td>{g.latest}</td><td>{g.stored??'Unknown'}</td></tr>)}</tbody></table>
      {gaps.length>40&&<p>Showing the first 40 of {gaps.length}; the full notice set remains in the collection.</p>}
      <details><summary>Web evidence ({scan.web.length})</summary><ul>{scan.web.map(w=><li key={w.id}><a href={w.url} target="_blank" rel="noreferrer">{w.title}</a> · {w.publisher} · published {w.publishedAt??'Unknown — not a dated event signal'} · first seen {w.observedAt} · matched {w.tickers.join(', ')||'Unresolved issuer'}</li>)}</ul></details>
      {scan.identityConflicts.length>0&&<p>Identity conflicts excluded from new quote checks: {scan.identityConflicts.join(', ')}.</p>}
    </>}
  </section>;
}
