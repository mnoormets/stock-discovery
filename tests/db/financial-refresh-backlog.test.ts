import {beforeEach,describe,it,expect} from 'vitest';
import {pool} from '../../src/lib/db';
import {getFilingRefreshBacklog} from '../../src/lib/financial-refresh-backlog';
import type {DiscoveryEvidence} from '../../src/lib/discovery-evidence';
import {insertCompany} from '../fixtures/company';
import {resetDb} from '../setup/reset';
beforeEach(resetDb);
async function seed(){const id=await insertCompany('KNOWN');await pool.query("UPDATE companies SET sec_cik='0000000001' WHERE id=$1",[id]);await pool.query("INSERT INTO price_snapshots(company_id,price,source) VALUES($1,10,'test')",[id]);
 await pool.query("INSERT INTO financial_facts(company_id,metric,value,unit,period_end,period_kind,form_type,filed_at,accession_number,taxonomy,tag,is_derived,source_url,fact_key,updated_at) VALUES($1,'revenue',10,'USD','2025-12-31','annual','10-K','2026-01-01','old','us-gaap','Revenue',false,'https://sec.gov/old','old',now()-interval '8 days')",[id]);
 const at=(await pool.query('SELECT clock_timestamp() now,current_date::text date')).rows[0];const scan={version:'discovery-evidence-v1',filings:[{cik:'0000000001',form:'10-Q',filedAt:at.date,observedAt:at.now.toISOString()}]} as DiscoveryEvidence;
 await pool.query("INSERT INTO collection_runs(trigger,status,started_at,metrics) VALUES('test','running',now(),$1::jsonb)",[JSON.stringify({discoveryEvidence:scan})]);return{id,scan};}
describe('financial backlog transparency',()=>{
 it('explains shared budget exhaustion and priority without performing enrichment or changing data',async()=>{
 const {scan}=await seed();for(let i=0;i<20;i++){const id=await insertCompany('DONE'+i);await pool.query("INSERT INTO financial_enrichment_status(company_id,status,last_attempt_at) VALUES($1,$2,clock_timestamp())",[id,i===0?'error':i===1?'unavailable':'success']);}
 const before=(await pool.query('SELECT to_jsonb(s) data FROM financial_enrichment_status s ORDER BY company_id')).rows;const b=await getFilingRefreshBacklog(scan);expect(b).toMatchObject({used:20,remaining:0,successful:18,unavailable:1,failed:1});expect(b.rows[0]).toMatchObject({ticker:'KNOWN',eligibleRank:1,stored:'2026-01-01',reason:'Daily refresh allowance used'});
 await getFilingRefreshBacklog(scan);expect((await pool.query('SELECT to_jsonb(s) data FROM financial_enrichment_status s ORDER BY company_id')).rows).toEqual(before);expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
 });
 it('distinguishes remaining capacity, retry cooldown, missing coverage and already imported filings',async()=>{
 const {id,scan}=await seed();expect((await getFilingRefreshBacklog(scan)).rows[0]).toMatchObject({eligibleRank:1,reason:'Within remaining refresh allowance'});
 await pool.query("INSERT INTO financial_enrichment_status(company_id,status,last_attempt_at) VALUES($1,'error',now())",[id]);expect((await getFilingRefreshBacklog(scan)).rows[0]).toMatchObject({eligibleRank:null,reason:'Waiting for the existing retry interval'});
 await pool.query('DELETE FROM financial_enrichment_status');await pool.query('DELETE FROM price_snapshots');expect((await getFilingRefreshBacklog(scan)).rows[0].reason).toContain('recent-price coverage');
 await pool.query('UPDATE financial_facts SET filed_at=current_date');expect((await getFilingRefreshBacklog(scan)).rows).toEqual([]);
 });
 it('does not display future/unrecognized filing observations as refresh gaps',async()=>{
 const {scan}=await seed();const future={...scan,filings:scan.filings.map(f=>({...f,observedAt:'2099-01-01T00:00:00Z'}))};expect((await getFilingRefreshBacklog(future)).rows).toEqual([]);
 expect((await getFilingRefreshBacklog({...scan,filings:scan.filings.map(f=>({...f,form:'8-K'}))})).rows).toEqual([]);
 });
});
