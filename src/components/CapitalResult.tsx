import { getCapitalDashboard } from '@/lib/paper-capital';

function usd(v: number | null) { return v==null?'Awaiting usable prices':new Intl.NumberFormat('et-EE',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v); }
export default function CapitalResult({data}: {data: NonNullable<Awaited<ReturnType<typeof getCapitalDashboard>>>}) {
  const book=data.books.find(b=>b.book==='strategy')!;
  const benchmark=data.books.find(b=>b.book==='benchmark')!;
  const days=Math.floor((Date.now()-Date.parse(data.startedAt))/86400000);
  const remaining=book.realizedProfitUsd==null?null:Math.max(0,data.rules.targetProfitUsd-book.realizedProfitUsd);
  return <section className="section moneyResult" aria-label="20000 dollar paper experiment">
    <div className="sectionHeading"><h2>$20,000 paper experiment · $10,000 profit target</h2><span className="pill watch">{data.status}</span></div>
    <article className="card paperBook moneySummary">
      <h3 className={book.profitUsd==null?'scoreNeutral':book.profitUsd>=0?'positive':'negative'}>{book.profitUsd==null?'Portfolio profit awaiting prices':`Total paper gain / loss: ${usd(book.profitUsd)}`}</h3>
      <dl className="backtestMetrics">
        <div><dt>Starting capital · no top-ups</dt><dd>{usd(data.rules.initialUsd)}</dd></div>
        <div><dt>Cash remaining</dt><dd>{usd(book.cashUsd)}</dd></div>
        <div><dt>Cash + holdings</dt><dd>{usd(book.equityUsd)}</dd></div>
        <div><dt>Realized gain / loss after costs</dt><dd>{usd(book.realizedProfitUsd)}</dd></div>
        <div><dt>Remaining realized profit to target</dt><dd>{usd(remaining)}</dd></div>
        <div><dt>Matched SPY gain / loss</dt><dd>{usd(benchmark.profitUsd)}</dd></div>
      </dl>
      <p>Day {days} since activation · {book.positions.length}/{data.rules.maxPositions} positions. A $10,000 monthly target requires +50%; it is not a forecast. Open-position gains do not count as realized profit.</p>
      <p className="muted">Fresh simulated purchases only, starting {new Date(data.startedAt).toLocaleString('et-EE',{timeZone:'Europe/Tallinn'})}. Commissions and {data.rules.slippageBps} bps modeled slippage included; taxes, FX, dividends and actual broker execution are excluded. This is paper money.</p>
      {days>30 && (!data.completedAt || Date.parse(data.completedAt)-Date.parse(data.startedAt)>30*86400000) && <p className="riskText">The first 30-day target has not been met.</p>}
      {book.issues.length>0 && <ul className="riskText">{book.issues.map(i=><li key={i}>{i}</li>)}</ul>}
      <p className="muted">Entry policy: {data.entryPolicy?.entry_version??data.version}. {data.entryPolicy ? `Growth early/momentum entries from new collections after ${new Date(data.entryPolicy.activated_at).toLocaleString('et-EE',{timeZone:'Europe/Tallinn'})}; previous trades and losses remain included.` : 'Original early-only entries.'}</p>
      {data.latestRun && <p className="muted">Last attempt: {new Date(data.latestRun.at).toLocaleString('et-EE',{timeZone:'Europe/Tallinn'})}. Candidates: {data.latestRun.candidateCount}. Fresh source: {data.latestRun.sourceCurrent?'yes':'no'}.</p>}
    </article>
    <div className="card tableWrap"><table><thead><tr><th>Stock</th><th>Purchase price</th><th>Latest price</th><th>Value</th><th>Open gain / loss after entry costs</th></tr></thead><tbody>
      {book.positions.length?book.positions.map(p=><tr key={p.ticker}><td><strong>{p.ticker}</strong></td><td>{usd(p.buyPrice)}</td><td>{usd(p.latestPrice)}<small>{p.markAt?new Date(p.markAt).toLocaleString('et-EE',{timeZone:'Europe/Tallinn'}):'Unknown quote time'}</small></td><td>{usd(p.valueUsd)}</td><td>{usd(p.profitUsd)}</td></tr>):<tr><td colSpan={5}>No filled purchases in this experiment yet.</td></tr>}
    </tbody></table></div>
    <details className="card"><summary>Experiment rules and filled trades</summary>
      <p>{data.entryPolicy?'Current post-activation growth-opportunities-v2 early/momentum candidates.':'Only current source-backed early-opportunities-v1 candidates.'} At most $2,000 including commission per entry, eight positions and $4,000 cash reserve; no averaging or re-entry for a ticker. Observed exits: −8% stop, +20% profit or 30 calendar days held. Equity at or below $18,000 stops new entries and attempts to close holdings. Equity at $30,000 attempts liquidation; success requires at least $30,000 cash with no open holdings after modeled sale costs.</p>
      <p className="riskText">Exit thresholds are checked only when the executor runs with fresh regular-session prices. Overnight gaps, missing quotes and the daily schedule can cause larger losses or missed exits. Split history is checked before using held quantities: a reported split or unavailable history blocks affected fills and valuation until reviewed; quantities are not automatically adjusted. These rules have not demonstrated profitability.</p>
      <table><thead><tr><th>Time</th><th>Book</th><th>Stock / side</th><th>Price</th><th>Gross / fee</th><th>Reason</th></tr></thead><tbody>{data.trades.slice(-50).reverse().map(t=><tr key={t.id}><td>{new Date(t.executed_at).toLocaleString('et-EE',{timeZone:'Europe/Tallinn'})}</td><td>{t.book_key}</td><td>{t.signal_ticker} / {t.side}</td><td>{usd(Number(t.price))}</td><td>{usd(Number(t.gross_usd))} / {usd(Number(t.fee_usd))}</td><td>{t.reason}</td></tr>)}</tbody></table>
    </details>
  </section>;
}
