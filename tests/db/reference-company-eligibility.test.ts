import {beforeEach,describe,it,expect,vi} from 'vitest';
import {pool} from '../../src/lib/db';
import * as financials from '../../src/lib/company-financials';
import {getRklbDiscoveryCandidates} from '../../src/lib/rklb-discovery';
import {recordDiscoveryRun,DISCOVERY_MODEL_VERSION} from '../../src/lib/discovery-validation';
import {fullyCoveredFinancials} from '../fixtures/financials';
import {makeDecisionInput} from '../fixtures/decision';
import {insertCompany} from '../fixtures/company';
import {resetDb} from '../setup/reset';
beforeEach(async()=>{vi.restoreAllMocks();await resetDb();});
describe('versioned reference-company eligibility',()=>{it('applies equal financial rules to RKLB and a control without rewriting the historical exclusion',async()=>{
 const summaries=[];let referenceId=0;
 for(const ticker of ['RKLB','CTRL']){const id=await insertCompany(ticker);if(ticker==='RKLB')referenceId=id;
 await pool.query("INSERT INTO price_snapshots(company_id,price,currency,market_cap,volume,market_at,source) VALUES($1,44,'USD',1000000000,1000000,clock_timestamp(),'test')",[id]);
 const f=fullyCoveredFinancials();f.ticker=ticker;for(const metric of ['revenue','net_income','operating_cash_flow','free_cash_flow'] as const)f.metrics[metric]!.yearOverYearPercent=100;summaries.push(f);}
 const old=await recordDiscoveryRun(['historical fixture'],[makeDecisionInput({companyId:referenceId,ticker:'RKLB',included:false,exclusionReasons:['old reference exclusion']})]);
 await pool.query("UPDATE discovery_runs SET model_version='rklb-discovery-v4' WHERE id=$1",[old.runId]);const historical=(await pool.query('SELECT to_jsonb(d) data FROM discovery_decisions d WHERE run_id=$1',[old.runId])).rows;
 vi.spyOn(financials,'getAllStoredCompanyFinancials').mockResolvedValue(summaries);
 const result=await getRklbDiscoveryCandidates();expect(result.candidates.map(c=>c.ticker).sort()).toEqual(['CTRL','RKLB']);expect(DISCOVERY_MODEL_VERSION).toBe('rklb-discovery-v5');
 expect((await pool.query('SELECT model_version FROM discovery_runs WHERE id=$1',[result.runId])).rows[0].model_version).toBe('rklb-discovery-v5');
 expect((await pool.query('SELECT to_jsonb(d) data FROM discovery_decisions d WHERE run_id=$1',[old.runId])).rows).toEqual(historical);
 expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
});});
