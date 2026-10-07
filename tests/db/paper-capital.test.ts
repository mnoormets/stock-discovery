import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { executeCapitalPaper as executeUnchecked, getCapitalDashboard, CAPITAL_VERSION, CAPITAL_RULES } from '../../src/lib/paper-capital';
import { evaluateEarlyFundamentals, evaluateEarlyHistory } from '../../src/lib/early-opportunities';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { makeFinancials } from '../fixtures/financials';
import { resetDb } from '../setup/reset';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';

const executeCapitalPaper = (options: Parameters<typeof executeUnchecked>[0]) => executeUnchecked({splitChecker:async holdings=>holdings.map(h=>({ticker:h.ticker,issue:null})),...options});
beforeEach(resetDb);
const now=new Date('2026-10-06T15:00:00Z');
function candidate(ticker: string) {
  const stock={ticker,name:ticker,price:110,marketAt:new Date(now.getTime()-240000).toISOString(),changePercent:1,marketCap:1e9,volume:1e6,relativeVolume:1,channels:[],warnings:[]};
  const financial=makeFinancials({revenue:{value:150,previousValue:100,yoy:50},operating_cash_flow:{value:20}});
  return evaluateEarlyHistory(evaluateEarlyFundamentals(stock,financial,now),{meta:{symbol:ticker,currency:'USD'},quotes:[30,90,180].map(d=>({date:new Date(now.getTime()-d*86400000),close:100}))},now);
}
async function source(tickers=['AAA']) {
  const run=await startCollectionRun('capital-test');
  await succeedCollectionRun(run.id);
  await pool.query('UPDATE collection_runs SET started_at=$2,finished_at=$3,duration_ms=59000,metrics=$4::jsonb WHERE id=$1',
    [run.id,new Date(now.getTime()-180000).toISOString(),new Date(now.getTime()-120000).toISOString(),JSON.stringify({marketRadar:{early:{version:'early-opportunities-v1',evaluatedAt:new Date(now.getTime()-150000).toISOString(),rows:tickers.map(candidate)}}})]);
  return run.id;
}
function fetcher(at=now,price=110,missing: string[]=[]): (tickers:string[])=>Promise<Map<string,YahooExecutionQuote>> {
  return async tickers=>new Map(tickers.filter(t=>!missing.includes(t)).map(t=>[t,{
    ticker:t,price:t==='SPY'?500:price,currency:'USD',marketState:'REGULAR',marketTime:new Date(at.getTime()-60000).toISOString(),source:'yahoo',raw:{symbol:t},
  }]));
}
describe('finite capital paper ledger',()=>{
  it('uses fixed cash and paired fills, keeps repeat runs idempotent and history immutable',async()=>{
    await source();
    const first=await executeCapitalPaper({now,quoteFetcher:fetcher()});
    const repeat=await executeCapitalPaper({now,quoteFetcher:fetcher()});
    expect(first.filledTrades).toBe(2);expect(first.cashUsd).toBe(18000);expect(repeat.filledTrades).toBe(0);
    const data=(await getCapitalDashboard(now))!;
    expect(data.books[0].realizedProfitUsd).toBe(0);
    expect(data.books[0].profitUsd).toBeLessThan(0);
    expect(data.trades).toHaveLength(2);
    await expect(pool.query("UPDATE paper_capital_trades SET reason='rewrite' WHERE id=$1",[data.trades[0].id])).rejects.toThrow('immutable');
    expect(await getCapitalDashboard(new Date(now.getTime()-86400000))).toBeNull();
  });
  it('enforces eight entry budgets and cash reserve even under simultaneous calls',async()=>{
    await source(['AAA','BBB','CCC','DDD','EEE','FFF','GGG','HHH','III','JJJ']);
    await Promise.all([executeCapitalPaper({now,quoteFetcher:fetcher()}),executeCapitalPaper({now,quoteFetcher:fetcher()})]);
    const data=(await getCapitalDashboard(now))!;
    expect(data.books[0].cashUsd).toBe(4000);expect(data.books[0].positions).toHaveLength(8);
    expect(data.trades).toHaveLength(16);
  });
  it('never spends cash with missing SPY or an already-jumped execution price',async()=>{
    await source();
    expect((await executeCapitalPaper({now,quoteFetcher:fetcher(now,110,['SPY'])})).filledTrades).toBe(0);
    expect((await executeCapitalPaper({now,quoteFetcher:fetcher(now,130)})).filledTrades).toBe(0);
    expect((await getCapitalDashboard(now))!.books[0].cashUsd).toBe(20000);
  });
  it('sells only after fresh paired exit quotes, realizes costs, and never re-enters a ticker',async()=>{
    await source();await executeCapitalPaper({now,quoteFetcher:fetcher()});
    const later=new Date('2026-10-07T15:00:00Z');
    expect((await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,90,['SPY'])})).filledTrades).toBe(0);
    const sold=await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,90)});
    expect(sold.filledTrades).toBe(2);
    const data=(await getCapitalDashboard(later))!;
    expect(data.books[0].positions).toHaveLength(0);expect(data.books[0].realizedProfitUsd).toBeLessThan(-300);
    expect(data.books[0].profitUsd).toBeCloseTo(data.books[0].realizedProfitUsd);
    expect((await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,110)})).filledTrades).toBe(0);
  });
  it('latches the risk floor and stops future entries after paired liquidation',async()=>{
    await source(['AAA','BBB','CCC','DDD','EEE','FFF','GGG','HHH']);
    await executeCapitalPaper({now,quoteFetcher:fetcher()});
    const later=new Date('2026-10-07T15:00:00Z');
    const stopped=await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,80)});
    expect(stopped.status).toBe('risk_stopped');expect(stopped.filledTrades).toBe(16);
    expect((await getCapitalDashboard(later))!.books[0].positions).toHaveLength(0);
    expect((await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,110)})).filledTrades).toBe(0);
  });
  it('declares success only after liquidation leaves $30,000 cash, not an open gain',async()=>{
    await source(['AAA','BBB','CCC','DDD','EEE','FFF','GGG','HHH']);
    await executeCapitalPaper({now,quoteFetcher:fetcher()});
    const later=new Date('2026-10-07T15:00:00Z');
    const result=await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,200)});
    expect(result.status).toBe('target_reached');
    const data=(await getCapitalDashboard(later))!;
    expect(data.books[0].cashUsd).toBeGreaterThanOrEqual(30000);expect(data.books[0].positions).toHaveLength(0);
    expect(data.books[0].realizedProfitUsd).toBeGreaterThanOrEqual(10000);
    expect(data.completedAt).toBe(later.toISOString());expect(data.version).toBe(CAPITAL_VERSION);expect(data.rules).toEqual(CAPITAL_RULES);
  });
  it('quarantines a split or missing check before any phantom gain can trigger liquidation',async()=>{
    await source(['AAA','BBB','CCC','DDD','EEE','FFF','GGG','HHH']);
    await executeCapitalPaper({now,quoteFetcher:fetcher()});
    const later=new Date('2026-10-07T15:00:00Z');
    const phantomQuote: ReturnType<typeof fetcher> = async tickers=>{ const quotes=await fetcher(later)(tickers); quotes.get('AAA')!.price=1000; return quotes; };
    const blocked=await executeCapitalPaper({now:later,quoteFetcher:phantomQuote,splitChecker:async holdings=>holdings.map(h=>({ticker:h.ticker,issue:h.ticker==='AAA'?'Split since entry requires quantity reconciliation.':null}))});
    expect(blocked.status).toBe('active');expect(blocked.filledTrades).toBe(0);expect(blocked.splitIssues).toHaveLength(1);
    const data=(await getCapitalDashboard(later))!;
    expect(data.books[0].profitUsd).toBeNull();expect(data.books[0].positions.map(p=>p.ticker)).toContain('AAA');
    expect(data.books[0].realizedProfitUsd).toBeLessThan(10000);
    const missing=await executeCapitalPaper({now:later,quoteFetcher:fetcher(later,200),splitChecker:async()=>[]});
    expect(missing.filledTrades).toBe(0);expect(missing.splitIssues.length).toBeGreaterThan(0);
  });
  it('does not convert stale collection evidence into a fresh entry',async()=>{
    await source();const late=new Date('2026-10-09T15:00:00Z');
    const result=await executeCapitalPaper({now:late,quoteFetcher:fetcher(late)});
    expect(result.sourceCurrent).toBe(false);expect(result.filledTrades).toBe(0);
    expect(result.issues).toContain('Current early scan unavailable; no new entries.');
  });
});
