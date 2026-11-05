import Link from 'next/link';
import type { MarketRadarSnapshot } from '@/lib/market-radar';
import { priceObservationRecency } from '@/lib/price-observation';

export default function RadarLeads({ snapshot, firstSeen, now }: {
  snapshot: MarketRadarSnapshot;
  firstSeen: Record<string, { at: string; price: number | null }>;
  now: string;
}) {
  const stocks = snapshot.stocks.filter(s => s.price != null && s.price > 0 && Number.isFinite(s.price)
    && s.changePercent != null && Number.isFinite(s.changePercent) && s.changePercent > 0
    && priceObservationRecency(s.marketAt, now) === 'recent')
    .sort((a,b) => b.changePercent! - a.changePercent! || a.ticker.localeCompare(b.ticker)).slice(0,5);
  return <section className="card" id="radar-leads">
    <h2>Five radar movers to research</h2>
    <p>Largest positive session changes in the latest collected radar, including names rejected by the growth filter. These moves have already happened; this is not a forecast or a buy instruction. Daily collection, not a live alert.</p>
    <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Stock</th><th>Observed USD price / session change</th><th>First recorded on radar</th><th>Growth filter evidence</th></tr></thead>
      <tbody>{stocks.map(stock => {
        const first = firstSeen[stock.ticker];
        const growth = snapshot.growth?.rows.find(r=>r.ticker===stock.ticker);
        return <tr key={stock.ticker}>
          <td><Link href={`/company/${encodeURIComponent(stock.ticker)}`}>{stock.ticker}</Link><br />{stock.name}</td>
          <td>${stock.price!.toFixed(2)} · +{stock.changePercent!.toFixed(2)}%<br /><small>{new Date(stock.marketAt!).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn</small></td>
          <td>{first ? <>{new Date(first.at).toLocaleString('en-GB', { timeZone: 'Europe/Tallinn' })} Tallinn<br />{first.price == null ? 'Original price unavailable' : `$${first.price.toFixed(2)} observed`}</> : 'First observation unavailable'}</td>
          <td>{growth ? <>{growth.state}<br />{growth.reasons.join(' ')}</> : 'Growth evidence unavailable; remains visible'}</td>
        </tr>;
      })}</tbody></table></div>
    {!stocks.length && <p>No positive movers with usable recent quotes in this collection.</p>}
    <p><small>First appearance is collection history, not a predicted turning point. Prices are source observations, not split-adjusted investment returns or earned profit. Missing evidence does not remove a mover.</small></p>
    <Link href="#market-radar">Review all radar names and source coverage</Link>
  </section>;
}
