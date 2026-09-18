import Link from 'next/link';
import PaperSignalEvidence from '@/components/PaperSignalEvidence';
import {
  getPaperBookStatus,
  getPaperPerformanceDashboard,
  type PaperBookPerformance,
} from '@/lib/paper-performance';
import type { PaperStrategyKey } from '@/lib/paper-strategy';

export const dynamic = 'force-dynamic';

const STRATEGIES: Array<{ key: PaperStrategyKey; name: string; rule: string }> = [
  {
    key: 'all_picks_baseline',
    name: 'Kõik canonical valikud',
    rule: 'Iga päev $100 iga kaasatud tickeri kohta. Korduv ticker tähendab uut hüpoteetilist ostu.',
  },
  {
    key: 'entry_aware',
    name: 'Entry-aware paper-entry signal',
    rule: 'See on appi hüpoteetiline ostusignaal: $100 intent tekib ainult siis, kui Growth ≥ 65, Health ≥ 65, Coverage ≥ 70, tänane market data on kinnitatud ja hinnalugu ei näita juba tugevat run-up’i. Iga uus eligible päev loob uue intent’i, ka korduva tickeri puhul.',
  },
];

function usd(value: number | null): string {
  if (value == null) return 'unknown';
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function percent(value: number | null): string {
  if (value == null) return 'unknown';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('et-EE', { maximumFractionDigits: 2 })}%`;
}

function dateTime(value: string | null): string {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function valueClass(value: number | null): string {
  if (value == null || value === 0) return 'scoreNeutral';
  return value > 0 ? 'positive' : 'negative';
}

function BookCard({ book, label }: { book: PaperBookPerformance; label: string }) {
  const status = getPaperBookStatus(book);
  const statusLabel = status.replace('_', ' ');
  const statusClass = status === 'valued' ? 'active' : status === 'pending' || status === 'valuation_incomplete' ? 'watch' : 'closed';
  return <article className="card paperBook">
    <div className="sectionHeading"><h3>{label}</h3><span className={`pill ${statusClass}`}>{statusLabel}</span></div>
    <dl className="backtestMetrics">
      <div><dt>Rahavoog sisse</dt><dd>{usd(book.investedUsd)}</dd></div>
      <div><dt>Väärtus markide ajal</dt><dd>{usd(book.currentValueUsd)}</dd></div>
      <div><dt>P/L</dt><dd className={valueClass(book.profitUsd)}>{usd(book.profitUsd)}</dd></div>
      <div><dt>Tootlus</dt><dd className={valueClass(book.returnPercent)}>{percent(book.returnPercent)}</dd></div>
      <div><dt>Avatud tickerid</dt><dd>{book.openPositions}</dd></div>
      <div><dt>Filled / pending / skipped</dt><dd>{book.filledOrders} / {book.pendingOrders} / {book.skippedOrders}</dd></div>
    </dl>
    <small>Markide vahemik: {dateTime(book.oldestMarkAt)} → {dateTime(book.newestMarkAt)}. Puuduv mark jääb unknown, mitte 0.</small>
    {book.valuationIssues.length > 0 && <ul className="riskText" aria-label="Valuation issues">
      {book.valuationIssues.map((issue) => <li key={issue}>{issue}</li>)}
    </ul>}
  </article>;
}

function MoneyResult({ book }: { book: PaperBookPerformance }) {
  const total = book.currentValueUsd == null ? null : book.currentValueUsd + book.saleProceedsUsd;
  return <section className="section moneyResult" aria-label="Paper profit and loss">
    <div className="sectionHeading"><h2>Are we making money?</h2><span className="pill watch">Paper money</span></div>
    <article className="card paperBook moneySummary">
      <h3 className={valueClass(book.profitUsd)}>{book.profitUsd == null
        ? book.filledOrders === 0 ? 'No purchases yet' : 'Total profit / loss awaiting prices'
        : book.profitUsd > 0 ? `We are up ${usd(book.profitUsd)}`
          : book.profitUsd < 0 ? `We are down ${usd(Math.abs(book.profitUsd))}` : 'We are breaking even'}</h3>
      <dl className="backtestMetrics">
        <div><dt>Money put in, including fees</dt><dd>{usd(book.investedUsd)}</dd></div>
        <div><dt>Holdings value + sale proceeds</dt><dd>{usd(total)}</dd></div>
        <div><dt>Gain / loss</dt><dd className={valueClass(book.profitUsd)}>{percent(book.returnPercent)}</dd></div>
      </dl>
      <p className="muted">Actual paper purchases under the app’s entry rules. Open holdings show gains or losses on paper; they are not cashed out. Values use the quote times below.</p>
      {book.profitUsd == null && book.filledOrders > 0 && <p className="riskText">Some prices cannot be used for a complete total. Available stock results are shown below; missing results are not zero.</p>}
      {book.pendingOrders > 0 && <small>{book.pendingOrders} orders awaiting purchase are excluded.</small>}
    </article>
    <div className="card tableWrap"><table>
      <thead><tr><th>Stock / first purchase</th><th>Average purchase price</th><th>Latest usable price</th><th>Money put in</th><th>Value + sale proceeds</th><th>Won / lost after fees</th></tr></thead>
      <tbody>{book.positions.length ? book.positions.map((position) => <tr key={position.ticker}>
        <td><strong>{position.ticker}</strong><small>{dateTime(position.firstBoughtAt)} · {position.open ? 'Holding' : 'Sold'}</small></td>
        <td>{usd(position.averageBuyPrice)}</td>
        <td>{position.open ? position.latestPrice == null ? 'Awaiting usable price' : usd(position.latestPrice) : 'Position closed'}<small>{position.open ? `Last quote: ${dateTime(position.markAt)}` : ''}</small></td>
        <td>{usd(position.investedUsd)}</td>
        <td>{usd(position.currentValueUsd == null ? null : position.currentValueUsd + position.saleProceedsUsd)}</td>
        <td className={valueClass(position.profitUsd)}><strong>{position.profitUsd == null ? 'Awaiting price' : `${position.profitUsd > 0 ? '+' : ''}${usd(position.profitUsd)}`}</strong><small>{percent(position.returnPercent)}</small></td>
      </tr>) : <tr><td colSpan={6}>No completed paper purchases yet.</td></tr>}</tbody>
    </table></div>
    <p className="muted">Profit starts at our purchase price, not at an earlier low. A rise before we bought does not count. Repeated purchases are combined per stock; fees are included. Taxes, dividends and execution slippage are not modeled.</p>
  </section>;
}

export default async function PerformancePage() {
  let dashboard = null;
  let error = '';
  try { dashboard = await getPaperPerformanceDashboard(); }
  catch (caught) { error = (caught as Error).message; }

  return <main className="wrap pageStack">
    <section className="hero compact">
      <p className="eyebrow">PAPER TRADING RESULTS</p>
      <h1>Money made or lost</h1>
      <p className="lead">What we put in, what it is worth, and whether we bought before the price went up or down.</p>
    </section>
    {error && <div className="notice danger">Paper strategy andmeid ei õnnestunud laadida: {error}</div>}
    {dashboard && !dashboard.available && <div className="notice">Paper strategy skeem ei ole selles andmebaasis veel rakendatud. Discovery töötab edasi muutmata; siia ei kuvata oletatud tulemusi.</div>}
    {dashboard?.available && <>
      <MoneyResult book={dashboard.books.find((book) => book.strategy === 'entry_aware' && book.book === 'strategy')!} />
      <details className="card"><summary>Comparison, strategy rules and trade history</summary>
      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">{dashboard.policyVersion}</p><h2>Kaks poliitikat, sama raha</h2></div><span className="muted">Seis: {dateTime(dashboard.generatedAt)}</span></div>
        <p className="muted">Valuation uses USD marks from the same New York date as SPY, within 20 minutes of its mark. Recency allows one elapsed New York trading day; weekends and the published 2026–2028 NYSE holidays add no days. Outside that published window the rule falls back conservatively to weekdays. Incomplete valuation stays unknown. Frozen signal-time labels below preserve the original policy assessment.</p>
        {STRATEGIES.map((strategy) => {
          const actual = dashboard.books.find((book) => book.strategy === strategy.key && book.book === 'strategy')!;
          const benchmark = dashboard.books.find((book) => book.strategy === strategy.key && book.book === 'benchmark')!;
          return <article className="paperStrategySection" key={strategy.key}>
            <div><h3>{strategy.name}</h3><p className="muted">{strategy.rule}</p></div>
            <div className="paperBookGrid"><BookCard book={actual} label="Appi valikud" /><BookCard book={benchmark} label="Sama rahavoog SPY-s" /></div>
          </article>;
        })}
      </section>
      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">IMMUTABLE SIGNAL CONTEXT</p><h2>Viimased paper-orderid</h2></div><Link href="/backtest">Ava horisondi-backtest</Link></div>
        <div className="card tableWrap"><table><thead><tr><th>Signal</th><th>Poliitika</th><th>Book</th><th>Order</th><th>Status</th><th>Täitmine</th><th>Business + market</th><th>Selgitus</th></tr></thead>
          <tbody>{dashboard.recentOrders.length ? dashboard.recentOrders.map((order) => <tr key={order.id}>
            <td><strong>{order.signalTicker}</strong><small>{dateTime(order.signalAt)}</small></td>
            <td>{order.strategy}</td><td>{order.book === 'benchmark' ? 'SPY benchmark' : order.instrumentTicker}</td>
            <td>{order.side.toUpperCase()} {order.grossUsd == null ? '$100 intent' : usd(order.grossUsd)}</td>
            <td>{order.status}</td><td>{order.executionPrice == null ? '—' : `${usd(order.executionPrice)} · ${dateTime(order.executedAt)}`}</td>
            <td><PaperSignalEvidence evidence={order.evidence} /></td>
            <td className="muted">{order.skipReason ?? '—'}</td>
          </tr>) : <tr><td colSpan={8} className="muted">Paper-signaale pole veel salvestatud.</td></tr>}</tbody>
        </table></div>
      </section>
      <aside className="card antiCheat"><h3>V1 aususe reeglid</h3><ul><li>Täitmine toimub ainult Yahoo <code>REGULAR</code> turuseisus ja kuni 20 minuti vanuse quote’iga.</li><li>Komisjon: 0,1%, minimaalselt $0.10 ja maksimaalselt $1 orderi kohta; maksud, dividendid ja FX ei ole V1-s modelleeritud.</li><li>Baseline ei varja stale signaali, kuid stale hind ei saa olla execution hind.</li><li>EXIT vajab kolme järjestikust tänase market data kinnitusega fundamentaalset läbikukkumist; top-listist kadumine üksi ei müü.</li></ul></aside>
      </details>
    </>}
  </main>;
}
