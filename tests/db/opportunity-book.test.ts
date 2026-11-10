import { beforeEach,describe,expect,it } from 'vitest';
import { pool } from '../../src/lib/db';
import { summarizeOpportunityResults } from '../../src/lib/opportunity-results';
import { getOpportunityBook,recordOpportunityPaper } from '../../src/lib/opportunity-book';
import { getPriceTrackingQueue,collectTrackedPrices } from '../../src/lib/price-tracking';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const start=new Date('2026-11-10T15:59:00Z'),entry=new Date('2026-11-10T16:00:00Z');let company:number;
async function seed(){company=await insertCompany('TEST');await pool.query(`INSERT INTO paper_capital_accounts(policy_version,initial_usd,target_profit_usd,rules,status,created_at) VALUES('early-capital-v1',20000,10000,'{}','risk_stopped',now())`);
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES('test','success',$1,$1,0,$2::jsonb)`,[start,JSON.stringify({opportunities:{version:'unified-opportunity-v1',evaluatedAt:start.toISOString(),rows:[{ticker:'TEST',name:'Test',state:'qualified_research',sources:['price_momentum'],urls:[],price:100,marketAt:'2026-11-10T15:58:00Z',financialPass:false}]}})]);}
async function quote(at:Date,price:number,currency='USD'){return (await pool.query(`INSERT INTO price_snapshots(company_id,price,currency,market_at,captured_at,source) VALUES($1,$2,$3,$4,$4,'test') RETURNING id`,[company,price,currency,at])).rows[0].id;}
describe('unified immutable cost journal',()=>{
 it('records entry/exit once with both costs and slippage, while preserving stopped capital and all old ledgers',async()=>{
  await seed();const original=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
  expect((await getPriceTrackingQueue(entry)).some(r=>r.ticker==='TEST')).toBe(true);const id=await quote(entry,100);
  expect(await recordOpportunityPaper(entry)).toEqual({inserted:1});expect(await recordOpportunityPaper(entry)).toEqual({inserted:0});
  expect((await getPriceTrackingQueue(entry)).some(r=>r.ticker==='TEST')).toBe(false);
  await quote(new Date('2026-11-10T15:59:30Z'),50);await recordOpportunityPaper(entry);
  expect((await getOpportunityBook(entry)).rows[0].buy?.quote_snapshot_id).toBe(String(id));
  const exit=new Date('2026-11-17T16:00:30Z');await quote(exit,110);expect(await recordOpportunityPaper(exit)).toEqual({inserted:1});
  const book=await getOpportunityBook(exit),row=book.rows[0];expect(row.status).toBe('complete_unverified');
  const expected=((1000-1)/(100*1.0005))*(110*.9995)-1-1000;expect(row.modeledNetUSD).toBeCloseTo(expected,8);
  const results=summarizeOpportunityResults(book.rows);expect(results.groups[0]).toMatchObject({entries:1,closed:1,wins:1,losses:0});expect(results.groups[0].closedNetUSD).toBeCloseTo(expected,8);expect(results.groups.find(g=>g.name==='price_momentum')?.closedNetUSD).toBeCloseTo(expected,8);
  expect(row.capitalDecision).toBe('blocked_by_capital_risk_stop');expect(Number(book.capital.cash_usd)).toBe(20000);
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(original);
  for(const table of ['paper_capital_trades','paper_strategy_orders'])expect((await pool.query('SELECT count(*)::int n FROM '+table)).rows[0].n).toBe(0);
  await expect(pool.query("UPDATE unified_opportunity_paper SET quantity=2")).rejects.toThrow('append-only');await expect(pool.query('DELETE FROM unified_opportunity_paper')).rejects.toThrow('append-only');
 });
 it('does not fill from stale/non-USD/future quotes or outside a regular session and retains missing entries',async()=>{
  await seed();await quote(new Date('2026-11-10T15:30:00Z'),100);await quote(entry,100,'EUR');await quote(new Date('2026-11-10T16:01:00Z'),100);
  expect(await recordOpportunityPaper(entry)).toEqual({inserted:0});expect((await recordOpportunityPaper(new Date('2026-11-15T16:00:00Z'))).skipped).toBe('outside regular session');
  expect((await getOpportunityBook(new Date('2026-11-13T16:00:00Z'))).rows[0].status).toBe('entry_unavailable');
 });
 it('connects the existing capped tracker to journal entries and remains idempotent on retry',async()=>{
  await seed();let calls=0;const options={now:entry,quoteFetcher:async()=>{calls++;return new Map([['TEST',{ticker:'TEST',price:100,currency:'USD',marketState:'REGULAR',marketTime:entry.toISOString(),source:'yahoo' as const,raw:{}}]])}};
  expect((await collectTrackedPrices(options)).attempted).toBe(1);expect((await getOpportunityBook(entry)).rows[0].buy).not.toBeNull();
  expect((await collectTrackedPrices(options)).attempted).toBe(0);expect(calls).toBe(1);expect((await pool.query('SELECT count(*)::int n FROM unified_opportunity_paper')).rows[0].n).toBe(1);
 });
});

 it('waits before open, rejects prior close, preserves that failure and records only a later live-session observation',async()=>{
  await seed();let calls=0;const preopen=new Date('2026-11-11T13:00:00Z');
  const fetcher=async()=>{calls++;return new Map([['TEST',{ticker:'TEST',price:100,currency:'USD',marketState:'CLOSED',marketTime:'2026-11-10T21:00:00Z',source:'yahoo' as const,raw:{}}]])};
  expect((await collectTrackedPrices({now:preopen,quoteFetcher:fetcher})).attempted).toBe(0);expect(calls).toBe(0);
  const open=new Date('2026-11-11T15:00:00Z');expect((await collectTrackedPrices({now:open,quoteFetcher:fetcher})).stale).toBe(1);expect((await getOpportunityBook(open)).rows[0].buy).toBeNull();
  const later=new Date('2026-11-12T15:00:00Z');await collectTrackedPrices({now:later,quoteFetcher:async()=>new Map([['TEST',{ticker:'TEST',price:101,currency:'USD',marketState:'REGULAR',marketTime:later.toISOString(),source:'yahoo' as const,raw:{}}]])});
  expect((await getOpportunityBook(later)).rows[0].buy).not.toBeNull();expect((await pool.query('SELECT status FROM price_tracking_attempts ORDER BY tracking_date')).rows.map(x=>x.status)).toEqual(['stale','saved']);
  expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
 });
