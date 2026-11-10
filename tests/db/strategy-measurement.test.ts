import {beforeEach,describe,it,expect} from 'vitest';
import {pool} from '../../src/lib/db';
import {resetDb} from '../setup/reset';
import {registerResearchProtocols,freezeResearchCollection} from '../../src/lib/strategy-snapshots';
import {getStrategyCoverage,recordStrategyCoverage} from '../../src/lib/strategy-outcome-audit';
import {researchFacts} from '../fixtures/strategy-measurement';
import type {DiscoveryEvidence} from '../../src/lib/discovery-evidence';
beforeEach(resetDb);
async function seed(){
 await registerResearchProtocols();
 const c=(await pool.query("INSERT INTO companies(ticker,name,quote_type,currency,exchange,sec_cik) VALUES('KNOWN','Known Inc.','EQUITY','USD','NMS','0000000001') RETURNING id")).rows[0].id;
 for(const f of researchFacts())await pool.query(`INSERT INTO financial_facts(company_id,metric,value,unit,period_start,period_end,period_kind,form_type,filed_at,accession_number,taxonomy,tag,is_derived,source_url,fact_key)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,$14)`,[c,f.metric,f.value,f.unit,f.periodStart,f.periodEnd,f.periodKind,f.form,f.filedAt,f.accessionNumber,f.taxonomy,f.tag,f.sourceUrl,String(f.id)]);
 await pool.query("INSERT INTO price_snapshots(company_id,price,currency,market_cap,market_at,captured_at,source) VALUES($1,10,'USD',1000000000,clock_timestamp()-interval '1 minute',clock_timestamp(),'yahoo')",[c]);
 const run=(await pool.query("INSERT INTO collection_runs(trigger,status,started_at,metrics) VALUES('test','running',clock_timestamp(),'{}') RETURNING id,started_at")).rows[0];
 const now=(await pool.query('SELECT clock_timestamp() now')).rows[0].now.toISOString();
 const evidence:DiscoveryEvidence={version:'discovery-evidence-v1',observedAt:now,universeObservedAt:now,universeStatus:'sec',universeSize:2,
  universe:[{ticker:'KNOWN',name:'Known Inc.',cik:'0000000001',exchange:'Nasdaq'},{ticker:'UNPRICED',name:'Unpriced Inc.',cik:'0000000002',exchange:'Nasdaq'}],
  sources:[],filings:[],filingsBeforeLimit:0,web:[],quoteTickers:[],identityConflicts:[]};
 return {run,c,evidence};
}
async function finish(id:number){await pool.query("UPDATE collection_runs SET status='success',finished_at=clock_timestamp(),duration_ms=1 WHERE id=$1",[id]);}
describe('prospective research measurement ledger',()=>{
 it('registers once and blocks protocol and frozen-evidence mutations',async()=>{
  const {run,evidence}=await seed();await registerResearchProtocols();
  expect((await pool.query('SELECT count(*)::int n FROM research_protocols')).rows[0].n).toBe(2);
  await freezeResearchCollection(Number(run.id),evidence);
  await expect(pool.query("UPDATE research_protocols SET definition='{}'::jsonb")).rejects.toThrow('append-only');
  await expect(pool.query('DELETE FROM research_universes WHERE collection_run_id=$1',[run.id])).rejects.toThrow('append-only');
 });
 it('freezes the entire inventory, unknown/excluded names and repeatable signals without orders',async()=>{
  const {run,evidence,c}=await seed();const first=await freezeResearchCollection(Number(run.id),evidence);await finish(Number(run.id));
  expect(first.members).toBe(2);expect((await freezeResearchCollection(Number(run.id),evidence)).reused).toBe(true);
  await pool.query("UPDATE financial_facts SET value=-999 WHERE company_id=$1 AND metric='operating_cash_flow'",[c]);
  const at=(await pool.query('SELECT clock_timestamp() now')).rows[0].now.toISOString();
  const report=(await getStrategyCoverage(Number(run.id),at)).report!;
  expect(report.membershipRecords).toBe(2);expect(report.strategies.every(s=>s.reproducible)).toBe(true);
  const fund=report.strategies.find(s=>s.strategyId==='fundamental_growth_v1')!;
  expect(fund.groups[0].eligible).toBe(1);expect(fund.rows.some(r=>r.ticker==='UNPRICED'&&r.eligibility==='ineligible')).toBe(true);
  expect((await getStrategyCoverage(Number(run.id),at)).report).toEqual(report);
  for(const table of ['paper_capital_trades','paper_strategy_orders','unified_opportunity_paper'])
    expect((await pool.query('SELECT count(*)::int n FROM '+table)).rows[0].n).toBe(0);
 });
 it('does not retrofit a terminal historical collection or trust a future audit date',async()=>{
  const {run,evidence}=await seed();await finish(Number(run.id));
  await expect(freezeResearchCollection(Number(run.id),evidence)).rejects.toThrow('new collection');
  expect((await pool.query('SELECT count(*)::int n FROM research_universes')).rows[0].n).toBe(0);
  await expect(getStrategyCoverage(undefined,'2099-01-01T00:00:00Z')).rejects.toThrow('observed past');
 });
 it('records immutable as-of audits idempotently and preserves missing data in the denominator',async()=>{
  const {run,evidence}=await seed();await freezeResearchCollection(Number(run.id),evidence);await finish(Number(run.id));
  const at=(await pool.query('SELECT clock_timestamp() now')).rows[0].now.toISOString();
  await recordStrategyCoverage(Number(run.id),at);await recordStrategyCoverage(Number(run.id),at);
  expect((await pool.query('SELECT count(*)::int n FROM research_outcome_audits')).rows[0].n).toBe(1);
  await expect(pool.query('DELETE FROM research_outcome_audits')).rejects.toThrow('append-only');
 });
});
