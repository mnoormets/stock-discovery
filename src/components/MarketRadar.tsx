import RadarLeads from './RadarLeads';
import Link from 'next/link';
import { getMarketRadar, MARKET_RADAR_CHANNELS } from '@/lib/market-radar';
import { priceObservationRecency } from '@/lib/price-observation';

export default async function MarketRadar() {
  const data = await getMarketRadar().catch(() => null);
  const snapshot = data?.snapshot;
  const now = new Date().toISOString();
  return <>
    {snapshot && <RadarLeads snapshot={snapshot} firstSeen={data!.firstSeen} now={now} />}
    <section className="card" id="market-radar">
    <h2>Market radar — beyond social media</h2>
    <p>US-listed stocks from Yahoo screens, active source discovery and already collected market lookups. All observed names remain visible even without SEC financials. These are research leads, not paper buy signals or predictions of a price jump.</p>
    {!snapshot ? <p>No market radar snapshot is available from the latest collection.</p> : <>
      <p>{snapshot.stocks.length} distinct stocks · Observed {new Date(snapshot.observedAt).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn · Daily collection</p>
      {Date.now() - new Date(snapshot.observedAt).getTime() > 36 * 3600000 && <p className="notice warning">Radar refresh is overdue. These are older observations.</p>}
      {snapshot.financialEnrichmentError && <p className="notice warning">{snapshot.financialEnrichmentError}</p>}
      {snapshot.financialEnrichment && <p>SEC enrichment before this scan: {snapshot.financialEnrichment.status} · {snapshot.financialEnrichment.attempted} attempted · {snapshot.financialEnrichment.enriched} enriched · {snapshot.financialEnrichment.failed} failed · {snapshot.financialEnrichment.unavailable} unavailable · {snapshot.financialEnrichment.attemptedTodayBefore} attempted earlier today · {snapshot.financialEnrichment.dailyRemaining} remaining in the shared daily budget.</p>}
      <ul>{snapshot.channels.map((channel) => <li key={channel.id}>
        {channel.id==='collection_lookup'?'Already collected market lookups':channel.id==='source_discovery'?<a href="#discovery-evidence">Active web / filing discovery</a>:<a href={`https://finance.yahoo.com/research-hub/screener/${channel.id}/`} target="_blank" rel="noreferrer">{MARKET_RADAR_CHANNELS.find(c=>c.id===channel.id)?.label}</a>}
        {channel.status === 'failed' ? ' — Unavailable this run; coverage is incomplete.' : ` — ${channel.accepted} US equity observations from ${channel.received} returned rows (screen channels are capped at 25).`}
      </li>)}</ul>
      <p>Gainers have already moved. Growth screens provide additional leads; their provider criteria are not verified investment theses. This is a bounded sample, not the entire market. Volume ratio compares session volume with the three-month daily average and is incomplete during trading.</p>
      <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
        <table><thead><tr><th>Company</th><th>Why it appeared</th><th>Observed price</th><th>Session change</th><th>Volume / average</th><th>Financial evidence now</th><th>First radar observation</th><th>Growth filter evidence</th></tr></thead>
          <tbody>{[...snapshot.stocks].sort((a,b)=>(b.changePercent ?? -Infinity)-(a.changePercent ?? -Infinity) || a.ticker.localeCompare(b.ticker)).map((stock) => {
            const first = data!.firstSeen[stock.ticker];
            const growth = snapshot.growth?.rows.find(r=>r.ticker===stock.ticker);
            const usable = stock.price != null && priceObservationRecency(stock.marketAt, now) === 'recent';
            return <tr key={stock.ticker}>
              <td><Link href={`/company/${encodeURIComponent(stock.ticker)}`}>{stock.ticker}</Link><br /><small>{stock.name}</small></td>
              <td>{stock.channels.map((id) => id==='collection_lookup'?'Already collected market lookups':id==='source_discovery'?'Active web / filing discovery':MARKET_RADAR_CHANNELS.find((c) => c.id === id)?.label).join(', ')}</td>
              <td>{usable ? `$${stock.price!.toFixed(2)}` : 'Unavailable / stale'}<br /><small>{stock.marketAt ? new Date(stock.marketAt).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' }) : 'Quote time unknown'}</small></td>
              <td>{usable && stock.changePercent != null ? `${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%` : 'Unknown'}</td>
              <td>{stock.relativeVolume == null ? 'Unknown' : `${stock.relativeVolume.toFixed(2)}×`}</td>
              <td>{data!.facts[stock.ticker] ? 'SEC facts available — review coverage and freshness' : 'SEC facts missing — research incomplete; still visible'}</td>
              <td>{first ? <>{new Date(first.at).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn<br />{first.price == null ? 'Original price unavailable' : `${first.price.toFixed(2)} USD observed`}</> : 'Unknown'}</td>
              <td>{growth ? <>{growth.state}<br />{growth.reasons.join(' ')}</> : 'Growth evidence unavailable'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!snapshot.stocks.length && <p>No usable US equity observations returned. See channel status above.</p>}
      <p><small>Source: Yahoo Finance · {snapshot.version} · Quote time is separate from collection time. Financial availability is current, not a historical score.</small></p>
    </>}
  </section></>;
}
