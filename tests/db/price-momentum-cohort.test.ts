import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { getGrowthCohortReport } from '../../src/lib/growth-cohort';
import { getPriceTrackingQueue } from '../../src/lib/price-tracking';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
async function save(at:Date,rows:unknown[],version='price-momentum-review-v1',evaluatedAt=at.toISOString()) {
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES('test','success',$1,$1,0,$2::jsonb)`,[at,JSON.stringify({marketRadar:{growth:{priceMomentum:{version,evaluatedAt,rows}}}})]);
}
describe('prospective price momentum evidence and follow-up',()=>{
 it('keeps first qualification, missing outcomes and a capped follow-up without orders or hindsight backfill',async()=>{
  const now=(await pool.query('SELECT clock_timestamp() now')).rows[0].now as Date;
  const first=new Date(now.getTime()-8*86400000),ticker='MOM';const id=await insertCompany(ticker);
  const row={ticker,state:'observe',price:100,marketAt:new Date(first.getTime()-60000).toISOString()};
  await save(new Date(first.getTime()-86400000),[{...row,price:1}],'other-version');
  await save(first,[row]);await save(new Date(first.getTime()+60000),[{...row,price:150}]);
  const missing=await getGrowthCohortReport(7,'priceMomentum');expect(missing.rows).toHaveLength(1);
  expect(missing.rows[0]).toMatchObject({firstPrice:100,status:'endpoint_unavailable'});
  expect((await getPriceTrackingQueue(now)).find(r=>r.ticker===ticker)?.reasons).toContain('price momentum follow-up v1');
  await pool.query(`INSERT INTO price_snapshots(company_id,price,currency,market_at,captured_at,source) VALUES($1,110,'USD',$2,$2,'test')`,[id,new Date(first.getTime()+7*86400000)]);
  const measured=await getGrowthCohortReport(7,'priceMomentum');expect(measured.rows[0].priceChangePercent).toBeCloseTo(10);
  expect((await getPriceTrackingQueue(now)).some(r=>r.ticker===ticker)).toBe(false);
  expect((await getGrowthCohortReport()).rows).toHaveLength(0);
  for(const t of ['paper_capital_trades','paper_strategy_orders'])expect((await pool.query('SELECT count(*)::int n FROM '+t)).rows[0].n).toBe(0);
 });
 it('ignores unknown/nonqualifying, malformed and future evaluation timestamps',async()=>{
  const now=(await pool.query('SELECT clock_timestamp() now')).rows[0].now as Date;
  const at=new Date(now.getTime()-8*86400000);await insertCompany('MOM');
  const row={ticker:'MOM',state:'observe',price:100,marketAt:at.toISOString()};
  await save(at,[row],undefined,'invalid');await save(at,[row],undefined,new Date(now.getTime()+86400000).toISOString());
  await save(at,[{...row,state:'unknown'},{...row,ticker:'FLAT',state:'declining_or_flat'}]);
  expect((await getGrowthCohortReport(7,'priceMomentum')).rows).toHaveLength(0);expect(await getPriceTrackingQueue(now)).toHaveLength(0);
 });
});
