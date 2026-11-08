import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { makeDecisionInput } from '../fixtures/decision';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectTrackedPrices, getPriceTrackingQueue, priceTrackingHasErrors } from '../../src/lib/price-tracking';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const after=new Date('2026-11-09T16:00:00Z');
async function cohort(ticker='KVUE',cik:string|null='0001944048') {
 const id=await insertCompany(ticker);await pool.query('UPDATE companies SET sec_cik=$2 WHERE id=$1',[id,cik]);
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES('test','success',$1,$1,0,$2::jsonb)`,['2026-11-01T10:00:00Z',JSON.stringify({marketRadar:{growth:{version:'growth-opportunities-v2',evaluatedAt:'2026-11-01T10:00:00Z',rows:[{ticker,state:'unknown',price:100,marketAt:'2026-10-30T19:59:00Z'}]}}})]);return id;
}
describe('reviewed trading cessation research tracking',()=>{
 it('retains historical eligibility before verification but omits routine follow-ups afterward without changing snapshots',async()=>{
  await cohort();const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
  expect((await getPriceTrackingQueue(new Date('2026-11-08T12:00:00Z'))).map(r=>r.ticker)).toContain('KVUE');
  expect((await getPriceTrackingQueue(after)).map(r=>r.ticker)).not.toContain('KVUE');
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(before);
 });
 it.each([null,'9999999'])('does not suppress a missing or different issuer identity (%s)',async cik=>{
  await cohort('KVUE',cik);expect((await getPriceTrackingQueue(after)).map(r=>r.ticker)).toContain('KVUE');
 });
 it('preserves an earlier stale failure and does not create replacement prices or orders',async()=>{
  const id=await cohort();await pool.query(`INSERT INTO price_tracking_attempts(tracking_date,company_id,ticker,attempted_at,reasons,status,market_at) VALUES('2026-11-09',$1,'KVUE','2026-11-09T12:00:00Z',ARRAY['growth cohort follow-up v1'],'stale','2026-10-30T20:00:02Z')`,[id]);
  const before=(await pool.query('SELECT * FROM price_tracking_attempts ORDER BY id')).rows;
  const result=await collectTrackedPrices({now:after,quoteFetcher:async()=>{throw Error('do not retry');}});
  expect(result).toMatchObject({attempted:0,previousErrors:1});expect(priceTrackingHasErrors(result)).toBe(true);
  expect((await pool.query('SELECT * FROM price_tracking_attempts ORDER BY id')).rows).toEqual(before);
  for(const table of ['price_snapshots','paper_capital_trades','paper_strategy_orders'])expect((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n).toBe(0);
 });
 it('still fails an unexplained stale quote for an unreviewed symbol',async()=>{
  await cohort('OTHER');const result=await collectTrackedPrices({now:after,quoteFetcher:async()=>new Map([['OTHER',{ticker:'OTHER',price:100,currency:'USD',marketTime:'2026-10-30T20:00:02Z',marketState:'REGULAR',source:'yahoo',raw:{}}]])});
  expect(result).toMatchObject({attempted:1,stale:1});expect(priceTrackingHasErrors(result)).toBe(true);
 });
 it('retains open capital and real portfolio holdings for reconciliation',async()=>{
  const id=await cohort();await pool.query(`INSERT INTO portfolio_positions(company_id,ticker,quantity,average_buy_price,status) VALUES($1,'KVUE',10,10,'active')`,[id]);
  expect((await getPriceTrackingQueue(after)).map(r=>r.ticker)).toContain('KVUE');
  await pool.query("UPDATE portfolio_positions SET quantity=0 WHERE ticker='KVUE'");
  await pool.query("INSERT INTO paper_capital_accounts(policy_version,initial_usd,target_profit_usd,rules,created_at) VALUES('test',20000,10000,'{}','2026-10-01')");
  await pool.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,quantity,price,gross_usd,fee_usd,market_at,executed_at,evidence,reason) VALUES('test','strategy','KVUE','KVUE','buy',1,100,100,1,'2026-10-30T19:00:00Z','2026-10-30T19:01:00Z','{}','test')`);
  const before=(await pool.query('SELECT * FROM paper_capital_trades ORDER BY id')).rows;
  expect((await getPriceTrackingQueue(after)).map(r=>r.ticker)).toContain('KVUE');expect((await pool.query('SELECT * FROM paper_capital_trades ORDER BY id')).rows).toEqual(before);
 });
});


it('retains an open legacy control holding without changing its orders',async()=>{
  const id=await cohort();await recordDiscoveryRun([], [makeDecisionInput({companyId:id,ticker:'KVUE'})],new Date('2026-10-30T19:00:00Z'),'rklb_daily');
  await pool.query(`INSERT INTO paper_strategy_orders(policy_version,signal_snapshot_version,strategy_key,book_key,run_id,decision_id,signal_ticker,instrument_ticker,side,status,signal_at,eligibility_snapshot,execution_price,executed_quantity,gross_usd,fee_usd,executed_at,execution_market_time,execution_source)
    SELECT 'test','test','all_picks_baseline','strategy',run_id,id,'KVUE','KVUE','buy','filled','2026-10-30T19:00:00Z','{}',100,1,100,1,'2026-10-30T19:00:00Z','2026-10-30T19:00:00Z','test' FROM discovery_decisions`);
  const before=(await pool.query('SELECT * FROM paper_strategy_orders ORDER BY id')).rows;
  expect((await getPriceTrackingQueue(after)).map(r=>r.ticker)).toContain('KVUE');
  expect((await pool.query('SELECT * FROM paper_strategy_orders ORDER BY id')).rows).toEqual(before);
});
