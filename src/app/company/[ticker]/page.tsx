import Link from 'next/link';
import TickerSearch from '../../TickerSearch';
import { fetchCompanyResearch } from '@/lib/company-data';
import { normalizeTicker } from '@/lib/investment';

export const dynamic = 'force-dynamic';

function money(value: number | null, currency: string | null): string {
  if (value == null) return 'No data available yet';
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency: currency || 'USD' }).format(value);
}

function compact(value: number | null): string {
  if (value == null) return 'No data available yet';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return 'No data available yet';
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const ticker = normalizeTicker(decodeURIComponent(params.ticker));
  const research = ticker ? await fetchCompanyResearch(ticker) : null;

  if (!ticker || !research) {
    return (
      <main className="wrap pageStack">
        <TickerSearch initialValue={ticker || ''} />
        <section className="empty card"><h1>Ettevõtet ei leitud</h1><p>Kontrolli tickerit või proovi teist sümbolit. No data available yet.</p></section>
      </main>
    );
  }

  const { quote, news, secFilings } = research;
  const move = quote.price != null && quote.previousClose
    ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
    : null;
  const riskItems = secFilings.filter((filing) => ['8-K', '10-Q', '10-K', 'S-1'].includes(filing.form));

  return (
    <main className="wrap pageStack">
      <TickerSearch initialValue={ticker} />
      <section className="companyHeader">
        <div><p className="eyebrow">{quote.exchange || 'EXCHANGE UNKNOWN'} · {quote.quoteType || 'TYPE UNKNOWN'}</p><h1>{quote.ticker}</h1><p className="lead">{quote.name || 'No data available yet'}</p></div>
        <Link className="button secondary" href={`/portfolio?newTicker=${quote.ticker}`}>Lisa portfelli</Link>
      </section>

      <div className="metricGrid">
        <div className="metric"><span>Viimane hind</span><strong>{money(quote.price, quote.currency)}</strong>{move != null && <small className={move >= 0 ? 'positive' : 'negative'}>{move >= 0 ? '+' : ''}{move.toFixed(2)}% vs eelmine sulgemine</small>}</div>
        <div className="metric"><span>Turukapitalisatsioon</span><strong>{compact(quote.marketCap)}</strong></div>
        <div className="metric"><span>Maht</span><strong>{compact(quote.volume)}</strong></div>
        <div className="metric"><span>Järgmine tulemuste aeg</span><strong>{dateTime(quote.earningsAt)}</strong></div>
      </div>

      {research.warnings.map((warning) => <div className="notice" key={warning}>{warning}</div>)}

      <div className="contentGrid">
        <section className="card section"><h2>Viimased uudised</h2>{news.length === 0 ? <p className="muted">No data available yet</p> : <div className="itemList">{news.map((item) => <article key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.publisher || 'Allikas teadmata'} · {dateTime(item.publishedAt)}</small></article>)}</div>}</section>
        <section className="card section"><h2>SEC dokumendid</h2>{secFilings.length === 0 ? <p className="muted">No data available yet</p> : <div className="itemList">{secFilings.map((filing) => <article key={filing.id}><a href={filing.url} target="_blank" rel="noreferrer">{filing.form} · {filing.description || 'SEC filing'}</a><small>{filing.filedAt}</small></article>)}</div>}</section>
      </div>

      <section className="card section"><h2>Riskid ja katalüsaatorid</h2>{quote.earningsAt || riskItems.length ? <ul>{quote.earningsAt && <li>Tulemuste sündmus: {dateTime(quote.earningsAt)}. Sündmuse mõju pole ette ennustatud.</li>}{riskItems.slice(0, 3).map((filing) => <li key={filing.id}>{filing.form} avaldus kuupäevaga {filing.filedAt} vajab sisulist ülevaatust.</li>)}</ul> : <p className="muted">No data available yet</p>}</section>
    </main>
  );
}
