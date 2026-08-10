import PositionForm from './PositionForm';
import { deletePositionAction } from './actions';
import { getLatestPortfolioPrices, listPositions } from '@/lib/portfolio';
import { normalizeTicker } from '@/lib/investment';
import type { PortfolioPosition } from '@/lib/investment';

export const dynamic = 'force-dynamic';

function money(value: number, signed = false): string {
  const [whole, fraction] = Math.abs(value).toFixed(2).split('.');
  const formatted = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction}\u00a0€`;
  if (!signed || value === 0) return formatted;
  return `${value > 0 ? '+' : '−'}${formatted}`;
}

function percent(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('et-EE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function tone(value: number): string {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : '';
}

interface PositionPerformance {
  position: PortfolioPosition;
  price: number | null;
  capturedAt: string | null;
  marketValue: number | null;
  unrealizedPl: number | null;
  unrealizedPercent: number | null;
  includedInTotals: boolean;
}

export default async function PortfolioPage({ searchParams }: { searchParams: { newTicker?: string; error?: string; message?: string } }) {
  let positions: PortfolioPosition[] = [];
  let dbError = '';
  let priceError = '';
  try { positions = await listPositions(); } catch (error) { dbError = (error as Error).message; }
  let latestPrices = new Map();
  if (!dbError) {
    try { latestPrices = await getLatestPortfolioPrices(positions.map((position) => position.ticker)); }
    catch (error) { priceError = (error as Error).message; }
  }
  const defaultTicker = normalizeTicker(searchParams.newTicker || '') || '';
  const performance: PositionPerformance[] = positions.map((position) => {
    const latest = latestPrices.get(position.ticker);
    const price = latest?.price ?? null;
    const includedInTotals = position.status !== 'closed' && position.quantity > 0 && price != null;
    return {
      position,
      price,
      capturedAt: latest?.capturedAt ?? null,
      marketValue: price == null ? null : price * position.quantity,
      unrealizedPl: price == null ? null : (price - position.averageBuyPrice) * position.quantity,
      unrealizedPercent: price == null || position.averageBuyPrice <= 0
        ? null
        : ((price - position.averageBuyPrice) / position.averageBuyPrice) * 100,
      includedInTotals,
    };
  });
  const included = performance.filter((item) => item.includedInTotals);
  const totalValue = included.reduce((sum, item) => sum + item.marketValue!, 0);
  const totalPl = included.reduce((sum, item) => sum + item.unrealizedPl!, 0);
  const totalCost = included.reduce(
    (sum, item) => sum + item.position.averageBuyPrice * item.position.quantity,
    0,
  );
  const totalPercent = totalCost > 0 ? (totalPl / totalCost) * 100 : null;
  const ranked = included
    .filter((item) => item.unrealizedPercent != null)
    .sort((a, b) => b.unrealizedPercent! - a.unrealizedPercent!);
  const winner = ranked[0] || null;
  const loser = ranked.length > 1 ? ranked[ranked.length - 1] : ranked[0] || null;
  const unavailableCount = performance.filter((item) =>
    item.position.status !== 'closed' && item.position.quantity > 0 && item.price == null,
  ).length;

  return (
    <main className="wrap pageStack">
      <section className="hero compact"><p className="eyebrow">PORTFOLIO MVP</p><h1>Portfell ja investeerimisteesid</h1><p className="lead">Salvesta otsuse kontekst. Rakendus ei anna ostu- ega müügisoovitusi.</p></section>
      {searchParams.message && <div className="notice success">{searchParams.message}</div>}
      {searchParams.error && <div className="notice danger">{searchParams.error}</div>}
      {dbError && <div className="notice danger">Andmebaas pole saadaval: {dbError}</div>}
      {priceError && <div className="notice danger">Live-hindu ei õnnestunud laadida: {priceError}</div>}

      {!dbError && positions.length > 0 && (
        <>
          <div className="metricGrid portfolioSummary">
            <div className="metric"><span>Portfelli koguväärtus</span><strong>{money(totalValue)}</strong><small>Avatud, hinnaga positsioonid</small></div>
            <div className="metric"><span>Kogu unrealized P/L</span><strong className={tone(totalPl)}>{money(totalPl, true)}</strong><small className={totalPercent == null ? '' : tone(totalPercent)}>{totalPercent == null ? 'Protsent pole saadaval' : percent(totalPercent)}</small></div>
            <div className="metric"><span>Suurim võitja</span><strong>{winner ? winner.position.ticker : '—'}</strong><small className={winner?.unrealizedPercent == null ? '' : tone(winner.unrealizedPercent)}>{winner?.unrealizedPercent == null ? 'Andmeid pole' : percent(winner.unrealizedPercent)}</small></div>
            <div className="metric"><span>Suurim kaotaja</span><strong>{loser ? loser.position.ticker : '—'}</strong><small className={loser?.unrealizedPercent == null ? '' : tone(loser.unrealizedPercent)}>{loser?.unrealizedPercent == null ? 'Andmeid pole' : percent(loser.unrealizedPercent)}</small></div>
          </div>
          {unavailableCount > 0 && <div className="notice">{unavailableCount} avatud positsiooni hind pole saadaval ja need ei sisaldu kogusummades.</div>}
        </>
      )}

      {!dbError && <details className="card editor" open={Boolean(defaultTicker) || positions.length === 0}><summary>Lisa uus positsioon</summary><PositionForm defaultTicker={defaultTicker} /></details>}

      <section className="section"><div className="sectionHeading"><h2>Positsioonid</h2><span className="muted">{positions.length} kirjet</span></div>
        {positions.length === 0 && !dbError ? <div className="empty card">Portfell on tühi. Lisa esimene aktiivne, jälgitav või suletud positsioon.</div> : <div className="positionList">{performance.map((item) => {
          const { position } = item;
          const excluded = position.quantity === 0 || position.status === 'closed';
          return (
            <details className="card editor" key={position.id}>
              <summary>
                <div className="positionSummary">
                  <div><strong className="ticker large">{position.ticker}</strong><span className="muted"> · {position.quantity} tk · avg cost {money(position.averageBuyPrice)}</span></div>
                  {item.price == null ? <div className="priceUnavailable">Hind pole saadaval</div> : (
                    <div className="positionPerformance">
                      <span>Hind <strong>{money(item.price)}</strong></span>
                      {excluded ? <span className="muted">{position.quantity === 0 ? 'Watch-positsioon · koguväärtusest väljas' : 'Suletud · koguväärtusest väljas'}</span> : (
                        <>
                          <span>Turuväärtus <strong>{money(item.marketValue!)}</strong></span>
                          <span>P/L <strong className={tone(item.unrealizedPl!)}>{money(item.unrealizedPl!, true)}{item.unrealizedPercent == null ? '' : ` (${percent(item.unrealizedPercent)})`}</strong></span>
                        </>
                      )}
                      <small>Hind seisuga {new Intl.DateTimeFormat('et-EE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.capturedAt!))}</small>
                    </div>
                  )}
                </div>
                <span className={`pill ${position.status}`}>{position.status}</span>
              </summary>
              <PositionForm position={position} />
              <form action={deletePositionAction} className="deleteForm"><input type="hidden" name="id" value={position.id} /><button className="dangerButton" type="submit">Eemalda positsioon</button></form>
            </details>
          );
        })}</div>}
      </section>
    </main>
  );
}
