import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { getGrowthOpportunityHistory, type GrowthOpportunity } from '../../src/lib/growth-opportunities';
import { getPriceTrackingQueue } from '../../src/lib/price-tracking';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const now = new Date('2026-10-07T16:00:00Z');
const row: GrowthOpportunity = { ticker: 'GROW', name: 'Growth', state: 'momentum', reasons: [], price: 100,
  marketAt: '2026-10-07T14:00:00Z', revenueGrowth: 50, facts: [], priceContext: null };
async function snapshot(at: string, value: GrowthOpportunity, version = 'growth-opportunities-v2') {
  await pool.query(`INSERT INTO collection_runs (trigger,status,started_at,finished_at,duration_ms,metrics)
    VALUES ('test','success',$1,$1,0,$2::jsonb)`, [at, JSON.stringify({ marketRadar: { growth: { version, evaluatedAt: at, rows: [value] } } })]);
}
describe('growth discovery forward evidence and policy separation', () => {
  it('does not expose an evaluation after the read clock even if the DB completion clock is earlier', async () => {
    await insertCompany('GROW');
    await snapshot('2026-10-07T17:00:00Z', row);
    await pool.query("UPDATE collection_runs SET finished_at='2026-10-07T15:00:00Z'");
    expect(await getGrowthOpportunityHistory(now)).toHaveLength(0);
    expect(await getPriceTrackingQueue(now)).toHaveLength(0);
  });
  it('freezes actual first discovery per category, ignores other versions and does not create paper orders', async () => {
    const id = await insertCompany('GROW');
    await snapshot('2026-10-06T14:00:00Z', { ...row, price: 1 }, 'future-policy');
    await snapshot('2026-10-07T14:01:00Z', row);
    await snapshot('2026-10-07T14:02:00Z', { ...row, price: 105 });
    await snapshot('2026-10-07T14:03:00Z', { ...row, state: 'excluded' });
    expect((await getPriceTrackingQueue(now))[0].reasons).toEqual(['growth opportunity']);
    const first = await getGrowthOpportunityHistory(now);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ row: { price: 100, state: 'momentum' }, observedAt: '2026-10-07T14:01:00Z', returnPercent: null });
    await pool.query(`INSERT INTO price_snapshots (company_id,price,currency,market_at,captured_at,source)
      VALUES ($1,110,'USD','2026-10-07T15:00:00Z','2026-10-07T15:01:00Z','test')`, [id]);
    expect((await getGrowthOpportunityHistory(now))[0].returnPercent).toBeCloseTo(10);
    await snapshot('2026-10-07T15:10:00Z', { ...row, price: 109, state: 'early' });
    const categories = await getGrowthOpportunityHistory(now);
    expect(categories.map(r => r.row.state).sort()).toEqual(['early', 'momentum']);
    expect(categories.find(r => r.row.state === 'momentum')!.row.price).toBe(100);
    expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int n FROM paper_capital_accounts')).rows[0].n).toBe(0);
  });
  it('withholds future and stale prices and expires tracking after 30 days without removing history', async () => {
    const id = await insertCompany('GROW');
    await snapshot('2026-10-07T14:01:00Z', row);
    await pool.query(`INSERT INTO price_snapshots (company_id,price,currency,market_at,captured_at,source)
      VALUES ($1,999,'USD','2026-10-08T15:00:00Z','2026-10-08T15:01:00Z','test')`, [id]);
    expect((await getGrowthOpportunityHistory(now))[0].returnPercent).toBeNull();
    const later = new Date('2026-11-10T16:00:00Z');
    expect((await getGrowthOpportunityHistory(later))[0].returnPercent).toBeNull();
    expect(await getPriceTrackingQueue(later)).toHaveLength(0);
    expect((await pool.query('SELECT count(*)::int n FROM collection_runs')).rows[0].n).toBe(1);
  });
});
