import Link from 'next/link';
import type { PortfolioPosition } from '@/lib/investment';
import { createPositionAction, updatePositionAction } from './actions';

export default function PositionForm({ position, defaultTicker = '' }: { position?: PortfolioPosition; defaultTicker?: string }) {
  const action = position ? updatePositionAction : createPositionAction;
  return (
    <form action={action} className="positionForm">
      {position && <input type="hidden" name="id" value={position.id} />}
      <div className="formGrid">
        <label><span>Ticker</span><input name="ticker" defaultValue={position?.ticker || defaultTicker} maxLength={10} required /></label>
        <label><span>Kogus</span><input name="quantity" type="number" min="0" step="any" defaultValue={position?.quantity ?? 0} required /></label>
        <label><span>Keskmine ostuhind (aktsia noteerimisvaluutas)</span><input name="averageBuyPrice" type="number" min="0" step="any" defaultValue={position?.averageBuyPrice ?? 0} required /></label>
        <label><span>Staatus</span><select name="status" defaultValue={position?.status || 'active'}><option value="active">Active</option><option value="watch">Watch</option><option value="closed">Closed</option></select></label>
        {!position && <label><span>Ajahorisont</span><input name="timeHorizon" defaultValue="" placeholder="Näiteks 2–3 aastat" maxLength={200} /></label>}
      </div>
      {position ? (
        <>
          <input type="hidden" name="thesis" value={position.thesis} />
          <input type="hidden" name="timeHorizon" value={position.timeHorizon} />
          <div className="notice thesisBuilderLink"><span>Struktureeritud teesi ja ajahorisonti muudetakse Thesis Builderis, et säilitada versiooniajalugu.</span><Link className="button secondary" href={`/thesis/${position.id}`}>Ava Thesis Builder</Link></div>
        </>
      ) : <label><span>Esialgne investeerimistees</span><textarea name="thesis" defaultValue="" rows={4} maxLength={5000} placeholder="Esialgne mõte; pärast lisamist saad selle Thesis Builderis struktureerida." /></label>}
      <label><span>Märkmed</span><textarea name="notes" defaultValue={position?.notes || ''} rows={3} maxLength={5000} /></label>
      <button className="primary" type="submit">{position ? 'Salvesta positsiooni andmed' : 'Lisa positsioon'}</button>
    </form>
  );
}
