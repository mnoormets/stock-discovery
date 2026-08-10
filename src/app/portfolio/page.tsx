import PositionForm from './PositionForm';
import { deletePositionAction } from './actions';
import { listPositions } from '@/lib/portfolio';
import { normalizeTicker } from '@/lib/investment';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage({ searchParams }: { searchParams: { newTicker?: string; error?: string; message?: string } }) {
  let positions = [];
  let dbError = '';
  try { positions = await listPositions(); } catch (error) { dbError = (error as Error).message; }
  const defaultTicker = normalizeTicker(searchParams.newTicker || '') || '';

  return (
    <main className="wrap pageStack">
      <section className="hero compact"><p className="eyebrow">PORTFOLIO MVP</p><h1>Portfell ja investeerimisteesid</h1><p className="lead">Salvesta otsuse kontekst. Rakendus ei anna ostu- ega müügisoovitusi.</p></section>
      {searchParams.message && <div className="notice success">{searchParams.message}</div>}
      {searchParams.error && <div className="notice danger">{searchParams.error}</div>}
      {dbError && <div className="notice danger">Andmebaas pole saadaval: {dbError}</div>}

      {!dbError && <details className="card editor" open={Boolean(defaultTicker) || positions.length === 0}><summary>Lisa uus positsioon</summary><PositionForm defaultTicker={defaultTicker} /></details>}

      <section className="section"><div className="sectionHeading"><h2>Positsioonid</h2><span className="muted">{positions.length} kirjet</span></div>
        {positions.length === 0 && !dbError ? <div className="empty card">Portfell on tühi. Lisa esimene aktiivne, jälgitav või suletud positsioon.</div> : <div className="positionList">{positions.map((position) => (
          <details className="card editor" key={position.id}>
            <summary><span><strong>{position.ticker}</strong> · {position.quantity} tk · keskmine {position.averageBuyPrice}</span><span className={`pill ${position.status}`}>{position.status}</span></summary>
            <PositionForm position={position} />
            <form action={deletePositionAction} className="deleteForm"><input type="hidden" name="id" value={position.id} /><button className="dangerButton" type="submit">Eemalda positsioon</button></form>
          </details>
        ))}</div>}
      </section>
    </main>
  );
}
