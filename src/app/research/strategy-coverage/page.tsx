import Link from 'next/link';
import { pool } from '@/lib/db';
import { getStrategyCoverage } from '@/lib/strategy-outcome-audit';
export const dynamic='force-dynamic';
export default async function StrategyCoveragePage({searchParams}:{searchParams:{collection?:string}}) {
 const id=searchParams.collection?Number(searchParams.collection):undefined;
 const {available,report}=await getStrategyCoverage(Number.isSafeInteger(id)?id:undefined);
 const collections=available?(await pool.query("SELECT u.collection_run_id,u.frozen_at FROM research_universes u JOIN collection_runs c ON c.id=u.collection_run_id WHERE c.status='success' ORDER BY frozen_at DESC LIMIT 30")).rows:[];
 return <main className="wrap page"><h1>Strategy Protocols &amp; Outcome Coverage</h1>
 <p>Two locked research hypotheses. No orders, funded account or changes to Today selection. This report measures coverage and reproducibility; it does not establish an investment edge.</p>
 {!available?<p>Measurement migration required.</p>:!report?<p>No prospective collection frozen after protocol registration yet. Historical collections are not relabeled.</p>:<>
 <p>Collection {report.collectionId} · frozen {report.frozenAt} · audit {report.asOf}.</p>
 <p>{report.inventoryCount} inventory records; {report.membershipRecords} retained identity memberships / {report.uniqueTickers} distinct tickers / {report.uniqueKnownIssuers} known issuers. Inventory: {report.inventoryStatus}. {report.scope}.</p>
 <nav>Recent collections: {collections.map(c=><span key={String(c.collection_run_id)}><Link href={'?collection='+c.collection_run_id}>#{c.collection_run_id}</Link>{' '}</span>)}</nav>
 <p>Default follows the first prospective collection. Eligible and excluded controls share the same later-quote measurement rule. A missing price, benchmark, delisting or identity never removes a row. All corporate actions are unverified: verified comparable outcomes remain zero.</p>
 {report.strategies.map(s=><section className="card" key={s.strategyId}>
 <h2>{s.strategyId}</h2><p>Version {s.version}; replay {s.reproducible?'matches frozen inputs':'unavailable or mismatch'}; source engine {s.engineMatches?'matches':'changed'}.</p>
 <details><summary>Locked protocol, source hashes and assumptions</summary><p>Version hash: {s.versionHash}. Snapshot hash: {s.snapshotHash}.</p><pre>{JSON.stringify(s.definition,null,2)}</pre></details>
 <p>Top six displayed eligible observations only; full rank and every exclusion remain in the frozen dataset and denominators.</p>
 <table><thead><tr><th>Ticker</th><th>Rank</th><th>Benchmark</th><th>Entry measurement</th></tr></thead><tbody>{s.rows.filter(r=>r.uiStatus==='eligible_visible').sort((a,b)=>a.rank-b.rank).map(r=><tr key={r.key}><td>{r.ticker}</td><td>{r.rank}</td><td>{r.benchmark??'Unknown'}</td><td>{r.entryStatus}</td></tr>)}</tbody></table>
 <h3>Full-universe funnel</h3><table><thead><tr><th>Stage</th><th>Retained rows</th><th>Share of universe</th></tr></thead><tbody>{s.funnel.map(f=><tr key={f.stage}><td>{f.stage}</td><td>{f.rows}</td><td>{f.percentOfUniverse==null?'Unknown':f.percentOfUniverse.toFixed(2)+'%'}</td></tr>)}</tbody></table>
 <h3>Coverage by eligibility, size and complete rank</h3>
 <table id={'coverage-'+s.strategyId}><thead><tr><th>Group</th><th>All rows</th><th>Eligible</th><th>Ineligible</th><th>UI cap excluded</th><th>Horizon</th><th>Due</th><th>Pending</th><th>Unavailable</th><th>Stock observed</th><th>Raw paired</th><th>Verified paired</th></tr></thead>
 <tbody>{s.groups.flatMap(g=>g.outcomes.map(o=><tr key={g.key+':'+o.horizonTradingDays}><td>{g.key}</td><td>{g.rows}</td><td>{g.eligible}</td><td>{g.ineligible}</td><td>{g.uiCapExcluded}</td><td>{o.horizonTradingDays} sessions</td><td>{o.due}</td><td>{o.pending}</td><td>{o.unavailable}</td><td>{o.stockObserved}</td><td>{o.rawPaired}</td><td>{o.verifiedComparable}</td></tr>))}</tbody></table>
 <details><summary>Missing inputs and exclusions</summary><ul>{Object.entries(s.missingReasons).map(([reason,n])=><li key={reason}>{reason}: {n}</li>)}</ul>
 <p>Names with missing inputs are retained. First 40 examples; the CLI JSON contains every record.</p><ul>{s.rows.filter(r=>r.reasons.length||r.missingComponents.length).slice(0,40).map(r=><li key={r.key}>{r.ticker}: {[...r.reasons,...r.missingComponents].join('; ')}</li>)}</ul></details>
 </section>)}
 <section className="card"><h2>Interpretation limits</h2><ul>{report.limitations.map(x=><li key={x}>{x}</li>)}</ul>
 <p>Coverage differs whenever an input, entry quote or matched benchmark is missing. Compare each eligible/ineligible, rank and size group before using observed returns. “Pending” has not failed; unavailable observations remain missing. No threshold search or winning strategy is selected by this report.</p></section>
 </>}
 </main>;
}
