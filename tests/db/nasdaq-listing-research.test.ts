import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectNasdaqListings, getNasdaqListings } from '../../src/lib/nasdaq-listings';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { getPriceTrackingQueue } from '../../src/lib/price-tracking';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
async function fixtures(tickers:string[]){const now=(await pool.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;const day=now.toISOString().slice(0,10);const [y,m,d]=day.split('-');return{now,text:(url:string)=>Promise.resolve(url.includes('AddsDeletes')?['Symbol|Company Name|NASDAQ Action|BX Action|PSX Action|Effective Date|Primary Listing Market',...tickers.map(t=>`${t}|${t}|Add|||${m}/${d}/${y}|Q`),`File Creation Time: ${m}${d}${y}12:00`].join('\n'):['Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',...tickers.map(t=>`${t}|${t} Common Stock|Q|N|N|100|N|N`),`File Creation Time: ${m}${d}${y}12:00`].join('\n'))};}
describe('production listing snapshot and tracking',()=>{
  it('persists real first prices idempotently, preserves evidence on replay and joins the shared tracking queue without buys',async()=>{
    const f=await fixtures(['NEW']);const quoteFetcher=async()=>new Map([['NEW',{ticker:'NEW',price:10,currency:'USD',marketTime:f.now.toISOString(),marketState:'REGULAR',source:'yahoo' as const,raw:{}}]]);
    const first=await collectNasdaqListings({fetchText:f.text,quoteFetcher});const r=await startCollectionRun('test');await succeedCollectionRun(r.id,{nasdaqListings:first});
    const repeated=await collectNasdaqListings({fetchText:f.text,quoteFetcher:async()=>{throw new Error('already priced, must not re-fetch');}});
    expect(repeated.rows[0].firstObservedAt).toBe(first.rows[0].firstObservedAt);expect(repeated.rows[0].firstPrice).toBe(10);expect(repeated.quoteAttempted).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM price_snapshots')).rows[0].n).toBe(1);
    expect((await getPriceTrackingQueue(new Date(f.now.getTime()+10000))).find(r=>r.ticker==='NEW')?.reasons).toContain('new Nasdaq listing');
    expect((await pool.query('SELECT count(*)::int AS n FROM paper_capital_trades')).rows[0].n).toBe(0);
    expect((await getNasdaqListings())?.rows[0].analysis).toBe('unknown');await startCollectionRun('test');expect(await getNasdaqListings()).toBeNull();
  });
  it('bounds quotes and rejects future/non-USD first prices, preserving an explicit source failure',async()=>{
    const f=await fixtures(Array.from({length:24},(_,i)=>`NEW${i}`));const scan=await collectNasdaqListings({fetchText:f.text,quoteFetcher:async names=>new Map(names.map(t=>[t,{ticker:t,price:10,currency:'EUR',marketTime:new Date(f.now.getTime()+600000).toISOString(),marketState:'REGULAR',source:'yahoo' as const,raw:{}}]))});
    expect(scan.quoteAttempted).toBe(20);expect(scan.quoteDeferred).toBe(4);expect(scan.rows.every(r=>r.firstPrice===null)).toBe(true);expect((await pool.query('SELECT count(*)::int AS n FROM price_snapshots')).rows[0].n).toBe(0);
    const failed=await collectNasdaqListings({fetchText:async()=>{throw new Error('source down');}});expect(failed.status).toBe('failed');expect(failed.rows).toEqual([]);
  });
});
