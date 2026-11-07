import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectTrackedPrices } from '../../src/lib/price-tracking';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const pre=new Date('2026-11-09T12:00:00Z'),session=new Date('2026-11-09T14:40:00Z');
async function listings(names:string[]) {
 for(const name of names)await insertCompany(name);
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES('test','success',$1,$1,0,$2::jsonb)`,['2026-11-08T12:00:00Z',JSON.stringify({nasdaqListings:{version:'nasdaq-listing-research-v1',rows:names.map(ticker=>({ticker,eligibility:'lookup_ready',firstObservedAt:'2026-11-08T12:00:00Z'}))}})]);
}
const fetcher=(at:string)=>(async(names:string[])=>new Map(names.map(ticker=>[ticker,{ticker,price:100,currency:'USD',marketTime:at,marketState:'REGULAR',source:'yahoo',raw:{}} as YahooExecutionQuote])));
describe('regular-session listing quote capacity',()=>{
 it('reserves ten shared slots before open and captures listings during the session without exceeding fifty or changing decisions',async()=>{
  await pool.query("INSERT INTO companies(ticker,name,source) SELECT 'W'||lpad(n::text,2,'0'),'Test','test' FROM generate_series(1,55)n");
  await pool.query("INSERT INTO portfolio_positions(company_id,ticker,quantity,average_buy_price,status) SELECT id,ticker,0,0,'watch' FROM companies");
  await insertCompany('SPY');await listings(Array.from({length:12},(_,i)=>'L'+String(i).padStart(2,'0')));
  const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
  const calls:string[][]=[];
  expect(await collectTrackedPrices({now:pre,quoteFetcher:async names=>{calls.push(names);return fetcher('2026-11-06T20:59:00Z')(names);}})).toMatchObject({attempted:40,saved:40});
  expect(calls.flat().some(t=>t.startsWith('L'))).toBe(false);
  calls.length=0;
  expect(await collectTrackedPrices({now:session,quoteFetcher:async names=>{calls.push(names);return fetcher('2026-11-09T14:39:00Z')(names);}})).toMatchObject({attempted:10,saved:10});
  expect(calls.flat()).toEqual(Array.from({length:10},(_,i)=>'L'+String(i).padStart(2,'0')));
  expect(await collectTrackedPrices({now:session,quoteFetcher:async()=>{throw Error('cap');}})).toMatchObject({attempted:0});
  expect((await pool.query('SELECT count(*)::int n FROM price_tracking_attempts')).rows[0].n).toBe(50);
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(before);
  expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
  expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
 });
 it('rejects a prior-close listing quote during a regular-session request without manufacturing an entry price',async()=>{
  await listings(['OLD']);
  expect(await collectTrackedPrices({now:session,quoteFetcher:fetcher('2026-11-06T20:59:00Z')})).toMatchObject({attempted:1,stale:1,saved:0});
  expect((await pool.query('SELECT count(*)::int n FROM price_snapshots')).rows[0].n).toBe(0);
 });
 it('keeps capital holdings ahead of reservation even if they consume the whole daily budget',async()=>{
  await pool.query("INSERT INTO companies(ticker,name,source) SELECT 'C'||lpad(n::text,2,'0'),'Test','test' FROM generate_series(1,50)n");
  await listings(['LATER']);
  await pool.query("INSERT INTO paper_capital_accounts(policy_version,initial_usd,target_profit_usd,rules,created_at) VALUES('test',20000,10000,'{}','2026-11-01')");
  await pool.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,quantity,price,gross_usd,fee_usd,market_at,executed_at,evidence,reason) SELECT 'test','strategy',ticker,ticker,'buy',1,1,1,0,'2026-11-02T15:00:00Z','2026-11-02T15:01:00Z','{}','test' FROM companies WHERE ticker LIKE 'C%'`);
  const before=(await pool.query('SELECT * FROM paper_capital_trades ORDER BY id')).rows;
  const called:string[]=[];expect(await collectTrackedPrices({now:pre,quoteFetcher:async names=>{called.push(...names);return fetcher('2026-11-06T20:59:00Z')(names);}})).toMatchObject({attempted:50});
  expect(called).not.toContain('LATER');expect((await pool.query('SELECT * FROM paper_capital_trades ORDER BY id')).rows).toEqual(before);
 });
});
