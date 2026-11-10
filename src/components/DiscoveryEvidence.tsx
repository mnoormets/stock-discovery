import ArticleContents from './ArticleContents';
import { pool } from '@/lib/db';
import { getFilingRefreshBacklog } from '@/lib/financial-refresh-backlog';
import type { DiscoveryEvidence as Snapshot } from '@/lib/discovery-evidence';
export default async function DiscoveryEvidence() {
  const result=(await pool.query("SELECT metrics->'discoveryEvidence' evidence FROM collection_runs ORDER BY id DESC LIMIT 1")).rows[0];
  const scan=result?.evidence as Snapshot|undefined;
  const backlog=scan?await getFilingRefreshBacklog(scan):null;
  const gaps=backlog?.rows??[];
  return <section className="card" id="discovery-evidence"><h2>Active web searches and filing updates</h2>
    <p>Queries search public financial news and the web; official SEC filings supply a separate issuer-wide update stream. These are source observations, not confirmed positive catalysts or forecasts. Coverage is bounded and failures stay visible.</p>
    {!scan?<p>No frozen multi-source discovery snapshot yet.</p>:<>
      <p>Observed {scan.observedAt}. Issuer inventory: {scan.universeSize} exchange-listed ticker records ({scan.universeStatus}); this is not a count of fully analysed common stocks. {scan.web.length} retained web observations · {scan.web.filter(w=>w.tickers.length).length} linked to issuers · {scan.filings.length} retained filings / {scan.filingsBeforeLimit} before the limit.</p>
      <p>Initial source quote checks: up to 10 names per collection, never/oldest attempted first. Existing 20 history and shared daily 20 financial / 50 follow-up limits remain. Unknown identity or security type is not a capital buy signal.</p>
      <details open><summary>Searches, source status and provenance</summary><ul>{scan.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.query}</a> — {s.kind}: {s.status}, {s.accepted} accepted / {s.received} received; observed {s.observedAt}; SHA256 {s.sha256??'unavailable'}</li>)}</ul></details>
      <ArticleContents scan={scan.articles}/>
      <h3>Newer financial reports awaiting stored facts</h3>
      <p>{backlog?.used} / {backlog?.dailyLimit} financial refresh attempts today (Tallinn day): {backlog?.successful} successful, {backlog?.unavailable} unavailable, {backlog?.failed} failed; {backlog?.remaining} remaining. Backlog checked {backlog?.asOf}.</p>
      <p>{gaps.length} known issuers have a newer observed financial filing than their stored facts. They receive refresh priority within the shared budget; a notice does not mean its numbers are already imported.</p>
      <table><thead><tr><th>Stock</th><th>Latest observed filing</th><th>Latest stored filing</th><th>Eligible queue position</th><th>Why it waits</th><th>Last attempt</th></tr></thead><tbody>{gaps.slice(0,40).map(g=><tr key={g.ticker}><td>{g.ticker}</td><td>{g.latest}</td><td>{g.stored??'Unknown'}</td><td>{g.eligibleRank??'Not eligible'}</td><td>{g.reason}</td><td>{g.lastAttemptAt??'Never'} · {g.lastStatus??'Unknown'}</td></tr>)}</tbody></table>
      {gaps.length>40&&<p>Showing the first 40 by current eligible queue position of {gaps.length}; the full notice set remains in the collection.</p>}
      <details><summary>Web evidence ({scan.web.length})</summary><ul>{scan.web.map(w=><li key={w.id}><a href={w.url} target="_blank" rel="noreferrer">{w.title}</a> · {w.publisher} · published {w.publishedAt??'Unknown — not a dated event signal'} · first seen {w.observedAt} · matched {w.tickers.join(', ')||'Unresolved issuer'}</li>)}</ul></details>
      {scan.identityConflicts.length>0&&<p>Identity conflicts excluded from new quote checks: {scan.identityConflicts.join(', ')}.</p>}
    </>}
  </section>;
}
