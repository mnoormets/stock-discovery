import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { getListingEntryEvaluation } from '../../src/lib/listing-entry-evaluation';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
async function observation(ticker:string,at:string,financialAssessment='unknown',sourceStatus='ok',status='success') {
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,error_message,metrics) VALUES('test',$1,$2,$2,0,$3,$4::jsonb)`,[status,at,status==='failure'?'test failure':null,JSON.stringify({nasdaqListings:{version:'nasdaq-listing-research-v1',status:sourceStatus,rows:[{ticker,eligibility:'lookup_ready',financialAssessment}]}})]);
}
describe('stored listing entry evidence',()=>{
 it('reads only valid first known source observations and leaves all original data and orders unchanged',async()=>{
  const id=await insertCompany('CHECK');await observation('CHECK','2026-10-12T13:40:00Z');await observation('CHECK','2026-10-13T13:40:00Z','passes');await observation('FAILED','2026-10-11T13:40:00Z','passes','failed');await observation('BADRUN','2026-10-11T13:40:00Z','passes','ok','failure');await observation('FUTURE','2099-10-11T13:40:00Z','passes');
  for(const at of ['2026-10-12T14:00:00Z','2026-10-19T14:00:00Z'])await pool.query(`INSERT INTO price_snapshots(company_id,price,currency,market_at,captured_at,source) VALUES($1,100,'USD',$2,$2,'test')`,[id,at]);
  const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;const prices=(await pool.query('SELECT * FROM price_snapshots ORDER BY id')).rows;
  const report=await getListingEntryEvaluation();expect(report.rows).toHaveLength(1);expect(report.rows[0]).toMatchObject({ticker:'CHECK',financialPass:false,status:'unverified_quote_scenario'});expect(report.rows[0].modeledNetUSD).toBeLessThan(0);
  expect(await getListingEntryEvaluation()).toMatchObject({rows:report.rows,groups:report.groups});
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(before);expect((await pool.query('SELECT * FROM price_snapshots ORDER BY id')).rows).toEqual(prices);
  expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
 });
 it('handles empty evidence and preserves missing price outcomes',async()=>{
  expect((await getListingEntryEvaluation()).rows).toEqual([]);await observation('MISSING','2026-10-12T13:40:00Z');
  const r=await getListingEntryEvaluation();expect(r.rows[0]).toMatchObject({status:'entry_unavailable',entry:null,exit:null,modeledNetUSD:null});expect(r.groups[0]).toMatchObject({total:1,missing:1,meanModeledNetUSD:null});
 });
});
