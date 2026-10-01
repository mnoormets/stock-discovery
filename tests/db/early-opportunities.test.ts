import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { getEarlyOpportunityHistory, type EarlyOpportunity } from '../../src/lib/early-opportunities';
import { getPriceTrackingQueue } from '../../src/lib/price-tracking';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const now = new Date('2026-10-01T15:00:00Z');
const row: EarlyOpportunity = { ticker: 'EARLY', name: 'Early', state: 'watch', reasons: [], price: 100,
  marketAt: '2026-09-30T20:00:00Z', revenueGrowth: 50, facts: [], priceContext: null };
async function snapshot(at: string, value: EarlyOpportunity) {
  await pool.query(`INSERT INTO collection_runs (trigger,status,started_at,finished_at,duration_ms,metrics)
    VALUES ('test','success',$1,$1,0,$2::jsonb)`, [at, JSON.stringify({ marketRadar: { early: { version: 'early-opportunities-v1', evaluatedAt: at, rows: [value] } } })]);
}
describe('early discovery forward history', () => {
  it('freezes the first price, tracks after disappearance, and withholds stale/future marks', async () => {
    const id = await insertCompany('EARLY');
    await snapshot('2026-10-01T10:00:00Z', row);
    await snapshot('2026-10-01T11:00:00Z', { ...row, price: 105 });
    await snapshot('2026-10-01T12:00:00Z', { ...row, state: 'excluded' });
    expect((await getPriceTrackingQueue(now))[0].reasons).toEqual(['early opportunity']);
    expect((await getEarlyOpportunityHistory(now))[0]).toMatchObject({ row: { price: 100 }, returnPercent: null, observedAt: '2026-10-01T10:00:00Z' });
    await pool.query(`INSERT INTO price_snapshots (company_id,price,currency,market_at,captured_at,source)
      VALUES ($1,110,'USD','2026-10-01T14:00:00Z','2026-10-01T14:01:00Z','test')`, [id]);
    expect((await getEarlyOpportunityHistory(now))[0].returnPercent).toBeCloseTo(10);
    await pool.query(`INSERT INTO price_snapshots (company_id,price,currency,market_at,captured_at,source)
      VALUES ($1,999,'USD','2026-10-02T14:00:00Z','2026-10-02T14:01:00Z','test')`, [id]);
    expect((await getEarlyOpportunityHistory(now))[0].returnPercent).toBeCloseTo(10);
    expect((await getEarlyOpportunityHistory(new Date('2026-10-10T15:00:00Z')))[0].returnPercent).toBeNull();
    expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
  });
});
