import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { fetchMarketRadar, getMarketRadar, persistMarketRadarCompanies } from '../../src/lib/market-radar';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
describe('market radar persistence', () => {
  it('keeps unscored stocks visible and replay does not duplicate prices or create paper buys', async () => {
    const now = new Date();
    const snapshot = await fetchMarketRadar(now, async () => ({ quotes: [{
      symbol: 'NEWR', quoteType: 'EQUITY', currency: 'USD', exchange: 'NMS',
      regularMarketTime: now, regularMarketPrice: 10,
    }] }));
    await persistMarketRadarCompanies(snapshot);
    await persistMarketRadarCompanies(snapshot);
    const run = await startCollectionRun('test');
    await succeedCollectionRun(run.id, { marketRadar: snapshot });
    const read = await getMarketRadar();
    expect(read.snapshot?.stocks.map((s) => s.ticker)).toEqual(['NEWR']);
    expect(read.facts.NEWR).toBe(0);
    expect((await pool.query('SELECT count(*)::int n FROM price_snapshots')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
    await startCollectionRun('test');
    expect((await getMarketRadar()).snapshot).toBeNull();
  });
});
