import CollectButton from './CollectButton';
import { getLatestDate, getTop } from '@/lib/db';
import { TOP_N } from '@/lib/config';

export const dynamic = 'force-dynamic';

function fmtCap(cap: number | null): string {
  if (!cap) return '—';
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap}`;
}

function growth(g: number | null) {
  if (g == null) return <span className="badge new">uus</span>;
  const pct = Math.round(Number(g) * 100);
  return <span className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '+' : ''}{pct}%</span>;
}

function parseWarnings(w: any): string[] {
  if (!w) return [];
  try { return JSON.parse(w); } catch { return []; }
}

export default async function Home() {
  let date: string | null = null;
  let rows: any[] = [];
  let dbError = '';

  try {
    date = await getLatestDate();
    if (date) rows = await getTop(date, TOP_N);
  } catch (e) {
    dbError = (e as Error).message;
  }

  return (
    <div className="wrap">
      <h1>📡 Stock Discovery</h1>
      <p className="sub">
        Radar vähemtuntud aktsiatele, mis tõusevad tähelepanu alt üles
        {date ? ` · viimane kogumine: ${date}` : ''}
      </p>

      <div className="warn">
        ⚠️ <strong>Informatiivne ideede-leidmise tööriist, MITTE investeerimisnõustamine.</strong>{' '}
        Väike turukap + järsk mainimiste kasv on ka klassikaline pump-and-dump profiil.
        Kõrge skoor tähendab „uuri lähemalt", mitte „osta". Kontrolli alati ise.
      </div>

      <CollectButton />

      {dbError && (
        <div className="warn">Andmebaasi viga: {dbError}. Kas Postgres töötab?</div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="empty">
          Andmeid pole veel. Vajuta „▶ Kogu andmed nüüd", et esimene snapshot teha.
        </div>
      )}

      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ticker</th>
              <th>Skoor</th>
              <th>Mainimised</th>
              <th>Kasv vs eile</th>
              <th>Sentiment</th>
              <th>Turukap</th>
              <th>Hind</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ticker}>
                <td>{i + 1}</td>
                <td className="ticker">
                  {r.ticker} {r.is_new && <span className="badge new">🆕</span>}
                  {r.rising_days >= 2 && <span className="badge tradestie">↑{r.rising_days}p</span>}
                  <div className="name">{r.name}</div>
                  {parseWarnings(r.warnings).map((w, k) => (
                    <div key={k} className="warn-flag">{w}</div>
                  ))}
                </td>
                <td><span className={`score ${parseWarnings(r.warnings).length ? 'flagged' : ''}`}>{Number(r.discovery_score).toFixed(1)}</span></td>
                <td>{r.mentions}</td>
                <td>{growth(r.mention_growth)}</td>
                <td>
                  {r.sentiment}{' '}
                  <span className={`badge ${r.sentiment_source === 'tradestie' ? 'tradestie' : ''}`}>
                    {r.sentiment_source === 'tradestie' ? 'Tradestie' : 'proxy'}
                  </span>
                </td>
                <td>
                  {fmtCap(r.market_cap ? Number(r.market_cap) : null)}
                  {r.fundamentals_source && <span className="src">{r.fundamentals_source}</span>}
                </td>
                <td>{r.price ? `${Number(r.price).toFixed(2)} ${r.currency ?? ''}` : '—'}</td>
                <td>
                  <a
                    href={`https://finance.yahoo.com/quote/${r.ticker}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)' }}
                  >
                    Yahoo ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
