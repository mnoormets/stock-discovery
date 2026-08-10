import Link from 'next/link';
import { getScannerData } from '@/lib/scanner';
import type { ScannerMover, ScannerScoreRow, ScannerScoreSort } from '@/lib/scanner';

export const dynamic = 'force-dynamic';

function money(value: number, currency: string | null): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return 'Aeg pole teada';
  return new Intl.DateTimeFormat('et-EE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function MoversTable({ rows, emptyText }: { rows: ScannerMover[]; emptyText: string }) {
  if (rows.length === 0) return <div className="empty card">{emptyText}</div>;
  return (
    <div className="tableWrap card scannerTable">
      <table>
        <thead><tr><th>Ticker</th><th>Liikumine</th><th>Hind</th><th>Eelmine snapshot</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.ticker}>
            <td><Link className="ticker" href={`/company/${encodeURIComponent(row.ticker)}`}>{row.ticker}</Link><div className="name">{row.name || 'Nimi puudub'}</div></td>
            <td><strong className={row.changePercent >= 0 ? 'positive' : 'negative'}>{row.changePercent >= 0 ? '+' : '−'}{Math.abs(row.changePercent).toLocaleString('et-EE', { maximumFractionDigits: 2 })}%</strong></td>
            <td>{money(row.price, row.currency)}</td>
            <td>{money(row.previousPrice, row.currency)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function scoreClass(value: number): string {
  if (value >= 65) return 'positive';
  if (value < 40) return 'negative';
  return 'scoreNeutral';
}

function ScoreTable({ rows }: { rows: ScannerScoreRow[] }) {
  if (rows.length === 0) return <div className="empty card">Skoorimiseks pole veel piisavalt SEC CompanyFactsi andmeid.</div>;
  return (
    <div className="tableWrap card scoreTable">
      <table>
        <thead><tr><th>Ticker</th><th>Growth Score</th><th>Financial Health</th><th>Coverage</th><th>Viimane hind</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.ticker}>
            <td><Link className="ticker" href={`/company/${encodeURIComponent(row.ticker)}`}>{row.ticker}</Link><div className="name">{row.name || 'Nimi puudub'}</div></td>
            <td>{row.growthScore == null ? <span className="muted">Andmeid napib</span> : <><strong className={`scoreValue ${scoreClass(row.growthScore)}`}>{row.growthScore}</strong><small>{row.growthCoverage}% andmekate</small></>}</td>
            <td>{row.healthScore == null ? <span className="muted">Andmeid napib</span> : <><strong className={`scoreValue ${scoreClass(row.healthScore)}`}>{row.healthScore}</strong><small>{row.healthCoverage}% andmekate</small></>}</td>
            <td><strong className={`scoreValue ${scoreClass(row.coverageScore)}`}>{row.coverageScore}</strong><small>kaalutud sisendikate</small></td>
            <td>{row.price == null ? <span className="muted">Hind puudub</span> : money(row.price, row.currency)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default async function ScannerPage({ searchParams }: { searchParams?: { sort?: string } }) {
  const scoreSort: ScannerScoreSort = searchParams?.sort === 'health' ? 'health' : searchParams?.sort === 'coverage' ? 'coverage' : 'growth';
  let data = null;
  let dbError = '';
  try { data = await getScannerData(scoreSort); }
  catch (error) { dbError = (error as Error).message; }

  if (!data) {
    return (
      <main className="wrap pageStack">
        <section className="hero compact"><p className="eyebrow">MARKET SCANNER</p><h1>Turu skänner</h1></section>
        <div className="notice danger">Skänneri andmeid ei õnnestunud laadida: {dbError}</div>
      </main>
    );
  }

  return (
    <main className="wrap pageStack">
      <section className="hero compact">
        <p className="eyebrow">COLLECTED MARKET DATA</p>
        <h1>Turu skänner</h1>
        <p className="lead">Viimaste salvestatud turuandmete ülevaade. Liikumine võrdleb ettevõtte kahte viimast hinnasnapshot’i.</p>
      </section>

      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">TODAY</p><h2>Suurimad hinnaliikumised</h2></div></div>
        <div className="scannerColumns">
          <div className="section"><h3 className="positive">Top gainers</h3><MoversTable rows={data.gainers} emptyText="Tänaseid tõusjaid pole veel piisavalt salvestatud." /></div>
          <div className="section"><h3 className="negative">Top losers</h3><MoversTable rows={data.losers} emptyText="Tänaseid langejaid pole veel piisavalt salvestatud." /></div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div><p className="eyebrow">SEC FUNDAMENTALS · 0–100</p><h2>Fundamentaalne edetabel</h2></div>
          <div className="scoreSort" aria-label="Skoori sortimine">
            <Link className={(data.scoreSort || scoreSort) === 'growth' ? 'active' : ''} href="/scanner?sort=growth">Top growth</Link>
            <Link className={(data.scoreSort || scoreSort) === 'health' ? 'active' : ''} href="/scanner?sort=health">Top financial health</Link>
            <Link className={(data.scoreSort || scoreSort) === 'coverage' ? 'active' : ''} href="/scanner?sort=coverage">Top coverage</Link>
          </div>
        </div>
        <p className="muted scoreIntro">Skoorid võrdlevad ettevõtet tema enda aastataguste SEC perioodidega. Andmekate näitab, kui suur osa kaalutud komponentidest oli arvutatav; Growth/Health vaates kuvatakse vähemalt 70 coverage read enne madala kattega ridu.</p>
        <ScoreTable rows={data.scoreRows || []} />
      </section>

      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">NEXT 14 DAYS</p><h2>Lähenevad earnings</h2></div><span className="muted">{data.earnings.length} sündmust</span></div>
        {data.earnings.length === 0 ? <div className="empty card">Järgmise 14 päeva earnings-sündmusi pole.</div> : <div className="eventGrid">{data.earnings.map((event) => (
          <article className="card eventCard" key={event.id}><Link className="ticker large" href={`/company/${encodeURIComponent(event.ticker)}`}>{event.ticker}</Link><strong>{dateTime(event.eventAt)}</strong><small>{event.name || 'Nimi puudub'}</small></article>
        ))}</div>}
      </section>

      <div className="scannerColumns">
        <section className="card section">
          <div className="sectionHeading"><h2>Värsked SEC filingud</h2><span className="muted">{data.secEvents.length}</span></div>
          {data.secEvents.length === 0 ? <p className="muted">SEC filinguid pole veel kogutud.</p> : <div className="itemList">{data.secEvents.map((event) => (
            <article key={event.id}><div><Link className="ticker" href={`/company/${encodeURIComponent(event.ticker)}`}>{event.ticker}</Link> · <a href={event.url} target="_blank" rel="noreferrer">{event.form}</a></div><small>{event.filedAt || 'Kuupäev puudub'} · {event.description || event.name || 'SEC filing'}</small></article>
          ))}</div>}
        </section>

        <section className="card section">
          <div className="sectionHeading"><h2>Uusimad uudised</h2><span className="muted">{data.news.length}</span></div>
          {data.news.length === 0 ? <p className="muted">Uudiseid pole veel kogutud.</p> : <div className="itemList">{data.news.map((item) => (
            <article key={item.id}><div><Link className="ticker" href={`/company/${encodeURIComponent(item.ticker)}`}>{item.ticker}</Link> · <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></div><small>{item.publisher || 'Allikas teadmata'} · {dateTime(item.publishedAt)}</small></article>
          ))}</div>}
        </section>
      </div>
    </main>
  );
}
