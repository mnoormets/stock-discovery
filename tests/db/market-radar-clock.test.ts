import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectMarketRadar } from '../../src/lib/market-radar';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { resetDb } from '../setup/reset';
vi.mock('yahoo-finance2', () => ({ default: class { async screener() { return { quotes: [] }; } } }));
beforeEach(resetDb);
afterEach(() => vi.useRealTimers());
describe('collection ledger clock integrity', () => {
  it('keeps both research evaluations before completion even with the desktop clock two minutes ahead', async () => {
    const dbTime = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(dbTime.getTime() + 120000));
    const run = await startCollectionRun('test');
    const snapshot = await collectMarketRadar();
    const completed = await succeedCollectionRun(run.id, { marketRadar: snapshot });
    expect(Date.parse(snapshot.early!.evaluatedAt)).toBeLessThanOrEqual(Date.parse(completed.finishedAt!));
    expect(snapshot.growth!.evaluatedAt).toBe(snapshot.early!.evaluatedAt);
    expect(Date.parse(snapshot.observedAt)).toBeLessThanOrEqual(Date.parse(snapshot.growth!.evaluatedAt));
    expect(Date.parse(snapshot.growth!.evaluatedAt)).toBeLessThan(Date.now() - 60000);
    expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
  });
});
