import { getOpportunityBook } from '@/lib/opportunity-book';
import { summarizeOpportunityResults, OPPORTUNITY_SOURCE_LABELS } from '@/lib/opportunity-results';
const usd=(n:number)=>'$'+n.toFixed(2);
export default async function OpportunityBook() {
  const book=await getOpportunityBook(),complete=book.rows.filter(r=>r.modeledNetUSD!=null);
  const results=summarizeOpportunityResults(book.rows);
  return <section className="card" id="opportunity-book"><h2>Unified opportunity and cost journal</h2>
    <p>Growth, price momentum, new listings, recent financial filings and multi-publisher mentions share one first-qualification history. A filing or headline mention is an unvalidated research hypothesis, not proof that a stock will rise.</p>
    <p><strong>Original capital experiment:</strong> {book.capital?book.capital.status+' · cash '+usd(Number(book.capital.cash_usd)):'Unavailable'}. This journal cannot activate it or place capital orders.</p>
    <p><strong>Unfunded quote scenarios:</strong> each independent ticket is {usd(book.rules.ticketUSD)}, with {usd(book.rules.feeUSD)} per side and {book.rules.slippageBps} bps slippage. Entries need a strictly later live regular-session USD quote within {book.rules.entryDays} days; exits use a live quote after {book.rules.holdDays} days, with {book.rules.exitGraceDays} days of grace. Recorded entries/exits are append-only. Missing endpoints are not zero profit.</p>
    <p>These are independent unallocated tickets, not a funded $20,000 portfolio. Corporate actions are unverified; taxes, dividends and FX are excluded. No quote-scenario result is credited to the original capital goal.</p>
    {!book.available&&<p className="notice warning">Journal migration 0013 is required. No scenario entries or exits can be recorded yet.</p>}
    <p>{book.rows.length} first qualified names · {book.rows.filter(r=>r.buy).length} entries · {complete.length} completed quote scenarios · {book.rows.filter(r=>r.status.endsWith('unavailable')).length} missing · version {book.version}.</p>
    <h3>Closed results by first-known selection reason</h3>
    <p>Every group includes pending and missing outcomes. Closed net includes the recorded commissions and slippage; no closed result means Unknown, not zero. Source groups overlap: a name belongs to each reason frozen at its first qualification. Do not add group totals or treat them as a funded portfolio return. Financial checks use the first snapshot, including unknown evidence. {results.version}.</p>
    <div style={{overflowX:'auto'}}><table id="opportunity-results"><thead><tr><th>Selection group</th><th>Names</th><th>Awaiting entry</th><th>Missing entry</th><th>Open</th><th>Missing exit</th><th>Closed</th><th>Wins / losses / flat</th><th>Closed net USD after costs</th><th>Best / worst net USD</th></tr></thead><tbody>{results.groups.map(g=><tr key={g.name}>
      <td>{OPPORTUNITY_SOURCE_LABELS[g.name]??g.name}</td><td>{g.candidates}</td><td>{g.awaitingEntry}</td><td>{g.missingEntry}</td><td>{g.open}</td><td>{g.missingExit}</td><td>{g.closed}</td><td>{g.wins} / {g.losses} / {g.flat}</td>
      <td>{g.closedNetUSD==null?'Unknown':usd(g.closedNetUSD)}</td><td>{g.bestNetUSD==null?'Unknown':usd(g.bestNetUSD)+' / '+usd(g.worstNetUSD!)}</td>
    </tr>)}</tbody></table></div>
    {!book.rows.length?<p>No frozen qualifying opportunities yet.</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th>Stock / evidence</th><th>First qualification</th><th>Capital decision</th><th>Model entry</th><th>Model exit</th><th>Net USD after model costs</th><th>Coverage</th></tr></thead><tbody>{book.rows.map(r=><tr key={r.ticker}>
      <td><a href={'/company/'+r.ticker}>{r.ticker}</a><br/>{r.sources.join(', ')}{r.urls.map(url=><span key={url}> · <a href={url} target="_blank" rel="noreferrer">Source</a></span>)}</td>
      <td>{r.firstQualifiedAt} · collection {r.collectionId}</td><td>{r.capitalDecision}</td>
      <td>{r.buy?usd(Number(r.buy.fill_price))+' / '+new Date(r.buy.market_at).toISOString():'Pending / unavailable'}</td>
      <td>{r.sell?usd(Number(r.sell.fill_price))+' / '+new Date(r.sell.market_at).toISOString():'Pending / unavailable'}</td>
      <td>{r.modeledNetUSD==null?'Unknown':usd(r.modeledNetUSD)}</td><td>{r.status}</td>
    </tr>)}</tbody></table></div>}
  </section>;
}
