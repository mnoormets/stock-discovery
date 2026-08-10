import Link from 'next/link';
import { addWatchlistAction, removeWatchlistAction } from './actions';
import { getWatchlistData, type WatchlistRow, type WatchlistSort } from '@/lib/watchlist';

export const dynamic = 'force-dynamic';

function scoreTone(value: number | null): string {
  if (value == null) return '';
  if (value >= 65) return 'positive';
  if (value < 40) return 'negative';
  return 'scoreNeutral';
}

function Row({ row, watched }: { row: WatchlistRow; watched: boolean }) {
  return (
    <tr>
      <td><Link className="ticker" href={`/company/${encodeURIComponent(row.ticker)}`}>{row.ticker}</Link><div className="name">{row.name || 'Nimi puudub'}</div></td>
      <td><strong className={scoreTone(row.growthScore)}>{row.growthScore ?? '—'}</strong></td>
      <td><strong className={scoreTone(row.healthScore)}>{row.healthScore ?? '—'}</strong></td>
      <td><strong className={scoreTone(row.coverageScore)}>{row.coverageScore}</strong></td>
      <td><span>{row.signal}</span>{row.warning && <div className="riskText">{row.warning}</div>}</td>
      <td>{row.price == null ? <span className="muted">Hind puudub</span> : row.price.toLocaleString('et-EE', { maximumFractionDigits: 2 })}</td>
      <td>{watched ? (
        <form action={removeWatchlistAction}><input type="hidden" name="id" value={row.positionId || ''} /><button className="secondary compactButton" type="submit">Eemalda</button></form>
      ) : (
        <form action={addWatchlistAction}><input type="hidden" name="ticker" value={row.ticker} /><button className="secondary compactButton" type="submit">+ Watchlist</button></form>
      )}</td>
    </tr>
  );
}

function WatchTable({ rows, watched, empty }: { rows: WatchlistRow[]; watched: boolean; empty: string }) {
  if (!rows.length) return <div className="empty card">{empty}</div>;
  return <div className="tableWrap card watchTable"><table><thead><tr><th>Ticker</th><th>Growth</th><th>Health</th><th>Coverage</th><th>Miks vaadata?</th><th>Hind</th><th /></tr></thead><tbody>{rows.map((row) => <Row row={row} watched={watched} key={`${row.positionId || 'idea'}:${row.ticker}`} />)}</tbody></table></div>;
}

export default async function WatchlistPage({ searchParams }: { searchParams?: { sort?: string; message?: string; error?: string } }) {
  const sort: WatchlistSort = searchParams?.sort === 'health' ? 'health' : searchParams?.sort === 'coverage' ? 'coverage' : 'growth';
  const data = await getWatchlistData(sort);
  return (
    <main className="wrap pageStack">
      <section className="hero compact"><p className="eyebrow">EXISTING DATA · NO NEW SOURCES</p><h1>Watchlist ja uued ideed</h1><p className="lead">Jälgi huvitavaid tickereid ning avasta olemasolevate SEC skooride põhjal ettevõtteid, mida tasub ise lähemalt uurida.</p></section>
      {searchParams?.message && <div className="notice success">{searchParams.message}</div>}
      {searchParams?.error && <div className="notice danger">{searchParams.error}</div>}

      <section className="card watchAdd"><div><h2>Lisa ticker käsitsi</h2><p className="muted">Watchlisti kirje kogus ja ostuhind on null ning seda ei arvestata portfelli koguväärtusse.</p></div><form action={addWatchlistAction}><input name="ticker" aria-label="Ticker" placeholder="Näiteks AAPL" required /><button className="primary" type="submit">Lisa Watchlisti</button></form></section>

      <section className="section"><div className="sectionHeading"><div><p className="eyebrow">SINU NIMEKIRI</p><h2>Jälgitavad ettevõtted</h2></div><span className="muted">{data.watched.length} tickerit</span></div><WatchTable rows={data.watched} watched empty="Watchlist on tühi. Lisa ticker käsitsi või vali idee allolevast tabelist." /></section>

      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">IDEA DISCOVERY</p><h2>Ideed olemasolevatest andmetest</h2></div><div className="scoreSort" aria-label="Ideede sortimine"><Link className={data.sort === 'growth' ? 'active' : ''} href="/watchlist?sort=growth">Growth</Link><Link className={data.sort === 'health' ? 'active' : ''} href="/watchlist?sort=health">Health</Link><Link className={data.sort === 'coverage' ? 'active' : ''} href="/watchlist?sort=coverage">Coverage</Link></div></div>
        <p className="muted scoreIntro">Nimekiri välistab juba aktiivsed ja jälgitavad positsioonid. Growth/Health sortimisel tulevad vähemalt 70 coverage ideed esimesena. Kõrge skoor tähendab “uuri lähemalt”, mitte “osta”.</p>
        <WatchTable rows={data.ideas} watched={false} empty="Uute ideede jaoks pole veel piisavalt score-andmeid." />
      </section>
    </main>
  );
}
