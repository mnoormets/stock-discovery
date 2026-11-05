import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectTrackedPrices, getPriceTrackingQueue } from '../../src/lib/price-tracking';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);
const first='2026-10-07T14:00:00Z';
const now=new Date('2026-10-14T16:00:00Z');
async function snapshot(ticker:string, options:{at?:string;price?:number|null;state?:string;evaluatedAt?:string;marketAt?:string}={}) {
  const at=options.at??first;
  const row={ticker,state:options.state??'excluded',price:options.price===undefined?100:options.price,
    marketAt:options.marketAt??'2026-10-07T13:59:00Z'};
  await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics)
    VALUES ('test','success',$1,$1,0,$2::jsonb)`,[at,JSON.stringify({marketRadar:{growth:{
      version:'growth-opportunities-v2',evaluatedAt:options.evaluatedAt??at,rows:[row]}}})]);
}

describe('full-cohort seven-day tracking',()=>{
  it('measures excluded and unknown names when due without changing discovery or creating orders',async()=>{
    await insertCompany('SPY');await insertCompany('EXCLUDED');await insertCompany('UNKNOWN');
    await snapshot('EXCLUDED');await snapshot('UNKNOWN',{state:'unknown'});
    const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
    expect((await getPriceTrackingQueue(new Date('2026-10-14T13:59:00Z'))).map(r=>r.ticker)).toEqual(['SPY']);
    const queue=await getPriceTrackingQueue(now);
    expect(queue.map(r=>r.ticker)).toEqual(['SPY','EXCLUDED','UNKNOWN']);
    expect(queue[1].reasons).toEqual(['growth cohort follow-up v1']);
    const quoteFetcher=async(tickers:string[])=>new Map(tickers.map((ticker):[string,YahooExecutionQuote]=>[ticker,{
      ticker,price:110,currency:'USD',marketTime:'2026-10-14T15:59:00Z',marketState:'REGULAR',source:'yahoo',raw:{},
    }]));
    expect(await collectTrackedPrices({now,quoteFetcher})).toMatchObject({attempted:3,saved:3});
    expect(await collectTrackedPrices({now,quoteFetcher:async()=>{throw Error('must not repeat');}})).toMatchObject({attempted:0});
    expect((await getPriceTrackingQueue(new Date('2026-10-15T16:00:00Z'))).map(r=>r.ticker)).toEqual(['SPY']);
    expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(before);
    expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
  });

  it('keeps the original first observation, including an unavailable baseline, and expires its window',async()=>{
    await insertCompany('ANCHOR');await insertCompany('MISSING');
    await snapshot('ANCHOR');await snapshot('ANCHOR',{at:'2026-10-11T14:00:00Z'});
    await snapshot('MISSING',{price:null});await snapshot('MISSING',{at:'2026-10-08T14:00:00Z'});
    expect((await getPriceTrackingQueue(now)).map(r=>r.ticker)).toEqual(['ANCHOR']);
    expect(await getPriceTrackingQueue(new Date('2026-10-18T16:00:00Z'))).toHaveLength(0);
  });

  it('does not count early, foreign-currency or future-known endpoints and withholds invalid clocks',async()=>{
    const id=await insertCompany('DUE');await snapshot('DUE');
    for(const [ticker,evaluatedAt,marketAt] of [
      ['BAD','not-a-time','2026-10-07T13:59:00Z'],
      ['FUTURE','2026-10-16T14:00:00Z','2026-10-07T13:59:00Z'],
      ['QUOTE',first,'2026-10-16T14:00:00Z'],
    ]){await insertCompany(ticker);await snapshot(ticker,{evaluatedAt,marketAt});}
    await pool.query(`INSERT INTO price_snapshots(company_id,price,currency,market_at,captured_at,source) VALUES
      ($1,110,'USD','2026-10-14T13:59:00Z','2026-10-14T14:00:00Z','test'),
      ($1,110,'EUR','2026-10-14T15:00:00Z','2026-10-14T15:01:00Z','test'),
      ($1,110,'USD','2026-10-14T15:00:00Z','2026-10-14T17:00:00Z','test')`,[id]);
    expect((await getPriceTrackingQueue(now)).map(r=>r.ticker)).toEqual(['DUE']);
    expect(await getPriceTrackingQueue(new Date('2026-10-14T17:01:00Z'))).toHaveLength(0);
  });

  it('prioritizes due cohorts after SPY while retaining the shared daily cap and idempotence',async()=>{
    await pool.query("INSERT INTO companies(ticker,name,source) SELECT 'A'||lpad(n::text,3,'0'),'Test','test' FROM generate_series(1,55)n");
    await pool.query("INSERT INTO portfolio_positions(company_id,ticker,quantity,average_buy_price,status) SELECT id,ticker,0,0,'watch' FROM companies");
    await insertCompany('SPY');await insertCompany('ZZZ');await snapshot('ZZZ',{state:'unknown'});
    expect((await getPriceTrackingQueue(now)).slice(0,2).map(r=>r.ticker)).toEqual(['SPY','ZZZ']);
    expect(await collectTrackedPrices({now,quoteFetcher:async()=>new Map()})).toMatchObject({attempted:50,missing:50,deferred:7});
    expect(await collectTrackedPrices({now,quoteFetcher:async()=>{throw Error('daily cap');}})).toMatchObject({attempted:0,deferred:7});
    const recorded=(await pool.query("SELECT reasons FROM price_tracking_attempts WHERE ticker='ZZZ'")).rows[0];
    expect(recorded.reasons).toEqual(['growth cohort follow-up v1']);
  });

  it('keeps open capital holdings ahead of research and removes closed holdings',async()=>{
    await insertCompany('SPY');await insertCompany('ZZZHOLD');await insertCompany('DUE');await snapshot('DUE');
    await pool.query(`INSERT INTO paper_capital_accounts(policy_version,initial_usd,target_profit_usd,rules,created_at)
      VALUES ('test',20000,10000,'{}',$1)`,[first]);
    await pool.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,
      quantity,price,gross_usd,fee_usd,market_at,executed_at,evidence,reason)
      VALUES ('test','strategy','ZZZHOLD','ZZZHOLD','buy',1,100,100,1,$1,$1,'{}','test')`,[first]);
    expect((await getPriceTrackingQueue(now)).map(r=>r.ticker)).toEqual(['SPY','ZZZHOLD','DUE']);
    await pool.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,
      quantity,price,gross_usd,fee_usd,market_at,executed_at,evidence,reason)
      VALUES ('test','strategy','ZZZHOLD','ZZZHOLD','sell',1,100,100,1,$1,$1,'{}','test')`,[now.toISOString()]);
    expect((await getPriceTrackingQueue(now)).map(r=>r.ticker)).toEqual(['SPY','DUE']);
  });
});
