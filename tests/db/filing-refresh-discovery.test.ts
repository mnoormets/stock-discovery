import { beforeEach,describe,expect,it } from 'vitest';
import { pool } from '../../src/lib/db';
import { financialEnrichmentQueue } from '../../src/lib/company-financials';
import { collectDiscoveryEvidence } from '../../src/lib/discovery-evidence';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
async function notice(observed:string,filedAt:string){await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,metrics) VALUES('test','running',now(),$1::jsonb)`,[JSON.stringify({discoveryEvidence:{version:'discovery-evidence-v1',filings:[{cik:'0000000001',form:'10-Q',filedAt,observedAt:observed}]}})]);}
describe('filing-driven financial refresh',()=>{
 it('prioritizes a genuinely newer filing even when stored facts are less than seven days old',async()=>{
  const id=await insertCompany('KNOWN');await pool.query("UPDATE companies SET sec_cik='0000000001' WHERE id=$1",[id]);
  await pool.query("INSERT INTO price_snapshots(company_id,price,captured_at,source) VALUES($1,10,now(),'test')",[id]);
  await pool.query(`INSERT INTO financial_facts(company_id,metric,value,unit,period_end,period_kind,form_type,filed_at,accession_number,taxonomy,tag,is_derived,source_url,fact_key) VALUES($1,'revenue',10,'USD','2025-12-31','annual','10-K','2026-01-01','old','us-gaap','Revenue',false,'https://sec.gov/old','old')`,[id]);
  await pool.query("INSERT INTO financial_enrichment_status(company_id,status,last_attempt_at,last_success_at) VALUES($1,'success',now()-interval '2 days',now()-interval '2 days')",[id]);
  expect(await financialEnrichmentQueue(1)).toHaveLength(0);
  const other=await insertCompany('EMPTY');await pool.query("INSERT INTO price_snapshots(company_id,price,captured_at,source) VALUES($1,10,now(),'test')",[other]);
  const date=(await pool.query("SELECT current_date::text date,clock_timestamp() now")).rows[0];await notice(date.now.toISOString(),date.date);
  expect((await financialEnrichmentQueue(1))[0].ticker).toBe('KNOWN');
  await pool.query('UPDATE financial_facts SET filed_at=current_date WHERE company_id=$1',[id]);expect((await financialEnrichmentQueue(1))[0].ticker).toBe('EMPTY');
 });
 it('ignores future notices and retains per-company retry cooldowns',async()=>{
  const id=await insertCompany('KNOWN');await pool.query("UPDATE companies SET sec_cik='0000000001' WHERE id=$1",[id]);await pool.query("INSERT INTO price_snapshots(company_id,price,captured_at,source) VALUES($1,10,now(),'test')",[id]);
  await pool.query("INSERT INTO financial_enrichment_status(company_id,status,last_attempt_at) VALUES($1,'error',now())",[id]);const t=(await pool.query("SELECT (clock_timestamp()+interval '1 day') future,current_date::text date")).rows[0];await notice(t.future.toISOString(),t.date);expect(await financialEnrichmentQueue(20)).toHaveLength(0);
 });
 it('records independent source failures, merges first observations idempotently and never writes orders',async()=>{
  const now=new Date('2026-11-09T17:00:00Z');const universe=JSON.stringify({fields:['cik','name','ticker','exchange'],data:[[1,'Acme Therapeutics Inc.','ACME','Nasdaq']]});
  const fetchText=async(url:string)=>{if(url.includes('company_tickers'))return universe;if(url.includes('news.google'))return '<rss><item><title>ACME stock raises guidance</title><link>https://publisher.test/a</link><pubDate>Mon, 9 Nov 2026 16:00:00 GMT</pubDate></item></rss>';throw Error('private network detail');};
  const first=await collectDiscoveryEvidence({now,fetchText});expect(first.web).toHaveLength(1);expect(first.quoteTickers).toEqual(['ACME']);expect(first.sources.some(s=>s.status==='failed')).toBe(true);expect(JSON.stringify(first)).not.toContain('private network');
  await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES('test','success',$1,$1,0,$2::jsonb)`,[now,JSON.stringify({discoveryEvidence:first})]);
  const next=await collectDiscoveryEvidence({now:new Date(now.getTime()+60000),fetchText});expect(next.web).toHaveLength(1);expect(next.web[0].observedAt).toBe(first.web[0].observedAt);
  expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
 });
});
