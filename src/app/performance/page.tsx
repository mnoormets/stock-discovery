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

export default async function PerformancePage() {
  let dashboard = null;
  let error = '';
  try { dashboard = await getPaperPerformanceDashboard(); }
  catch (caught) { error = (caught as Error).message; }

  return <main className="wrap pageStack">
    <section className="hero compact">
      <p className="eyebrow">PAPER STRATEGY · REAL SIGNAL TIME · NO BROKER ORDERS</p>
      <h1>Performance</h1>
      <p className="lead">Kas appi valikute järgi tegutsemine oleks päriselt raha teeninud? Siin mõõdetakse fikseeritud rahavooga hüpoteetilisi tehinguid ja sama rahavoo SPY võrdlust. See on falsifitseeritav katse, mitte ostu- ega müügisoovitus.</p>
    </section>
    {error && <div className="notice danger">Paper strategy andmeid ei õnnestunud laadida: {error}</div>}
    {dashboard && !dashboard.available && <div className="notice">Paper strategy skeem ei ole selles andmebaasis veel rakendatud. Discovery töötab edasi muutmata; siia ei kuvata oletatud tulemusi.</div>}
    {dashboard?.available && <>
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
    </>}
  </main>;
}
