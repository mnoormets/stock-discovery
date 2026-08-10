import Link from 'next/link';
import CollectButton from './CollectButton';
import TickerSearch from './TickerSearch';
import { getLatestDate, getTop } from '@/lib/db';
import { TOP_N } from '@/lib/config';

export const dynamic = 'force-dynamic';

function formatCap(cap: number | null): string {
  if (!cap) return 'No data available yet';
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString('et-EE')}`;
}

function parseWarnings(value: unknown): string[] {
  if (!value) return [];
  try { return JSON.parse(String(value)); } catch { return []; }
}

export default async function Home() {
  let date: string | null = null;
  let rows: any[] = [];
  let dbError = '';
  try {
    date = await getLatestDate();
    if (date) rows = await getTop(date, TOP_N);
  } catch (error) {
    dbError = (error as Error).message;
  }

  return (
    <main className="wrap pageStack">
      <section className="hero">
        <p className="eyebrow">INVESTMENT MONITORING V1</p>
        <h1>Jälgi ettevõtteid ja oma investeerimisteesi kontrollitavate andmetega.</h1>
        <p className="lead">See tööriist ei anna ostu- ega müügisoovitusi. See aitab märgata infot, mis vajab sinu ülevaatust.</p>
      </section>

      <TickerSearch />

      <div className="quickGrid">
        <Link className="card linkCard" href="/portfolio">
          <strong>Portfell</strong>
          <span>Positsioonid, teesid ja ajahorisondid</span>
        </Link>
        <Link className="card linkCard" href="/daily">
          <strong>Daily Changes</strong>
          <span>Uudised, hinnaliikumised ja lähenevad sündmused</span>
        </Link>
      </div>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">LEGACY RADAR</p>
            <h2>Redditi tähelepanuradar</h2>
          </div>
          <span className="muted">{date ? `Viimane kogumine: ${date}` : 'Andmeid pole veel kogutud'}</span>
        </div>
        <div className="notice">Kõrge skoor tähendab “uuri lähemalt”, mitte “osta”. Väike turukapitalisatsioon ja mainimiste järsk kasv võivad viidata manipulatsiooniriskile.</div>
        <CollectButton />
        {dbError && <div className="notice danger">Andmebaas pole saadaval: {dbError}</div>}
        {!dbError && rows.length === 0 && <div className="empty card">Radari andmeid pole veel.</div>}
        {rows.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Ticker</th><th>Skoor</th><th>Mainimised</th><th>Kasv</th><th>Turukapitalisatsioon</th><th>Hind</th></tr></thead>
              <tbody>{rows.map((row) => {
                const growth = row.mention_growth == null ? null : Math.round(Number(row.mention_growth) * 100);
                return (
                  <tr key={row.ticker}>
                    <td><Link className="ticker" href={`/company/${row.ticker}`}>{row.ticker}</Link><div className="name">{row.name}</div>{parseWarnings(row.warnings).map((warning) => <div className="riskText" key={warning}>{warning}</div>)}</td>
                    <td><span className="score">{Number(row.discovery_score).toFixed(1)}</span></td>
                    <td>{row.mentions}</td>
                    <td>{growth == null ? 'Uus' : `${growth >= 0 ? '+' : ''}${growth}%`}</td>
                    <td>{formatCap(row.market_cap ? Number(row.market_cap) : null)}</td>
                    <td>{row.price ? `${Number(row.price).toFixed(2)} ${row.currency || ''}` : 'No data available yet'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
