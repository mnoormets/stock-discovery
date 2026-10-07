import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { resetDb } from '../setup/reset';
import { executeCapitalPaper, getCapitalDashboard, CAPITAL_VERSION } from '../../src/lib/paper-capital';
import { activateGrowthCapitalEntry, GROWTH_CAPITAL_ENTRY_RULES, GROWTH_CAPITAL_ENTRY_VERSION } from '../../src/lib/paper-capital-entry';
import { evaluateGrowthFundamentals, evaluateGrowthHistory } from '../../src/lib/growth-opportunities';
import { makePoint } from '../fixtures/financials';
import type { YahooExecutionQuote } from '../../src/lib/yahoo';
const now=new Date('2026-10-07T15:00:00Z');
const splitChecker: NonNullable<Parameters<typeof executeCapitalPaper>[0]>['splitChecker']=async holdings=>holdings.map(h=>({ticker:h.ticker,issue:null}));
const quoteFetcher=async(tickers:string[])=>new Map(tickers.map(t=>[t,{ticker:t,price:t==='SPY'?500:140,currency:'USD',marketState:'REGULAR',marketTime:new Date(now.getTime()-30000).toISOString(),source:'yahoo',raw:{}} as YahooExecutionQuote]));
function candidate(ticker='BBB') {
  const period={periodStart:'2025-12-28',periodEnd:'2026-06-27',periodKind:'ytd' as const,filedAt:'2026-08-05',accessionNumber:'same'};
  const facts=[makePoint('revenue',150,period),makePoint('operating_cash_flow',20,period),makePoint('revenue',100,{...period,periodStart:'2024-12-29',periodEnd:'2025-06-28'})];
  const stock={ticker,name:ticker,price:140,marketAt:new Date(now.getTime()-120000).toISOString(),changePercent:1,marketCap:1e9,volume:1e6,relativeVolume:1,channels:[],warnings:[]};
  return evaluateGrowthHistory(evaluateGrowthFundamentals(stock,facts,now),stock,{meta:{symbol:ticker,currency:'USD'},quotes:[30,90,180].map(d=>({date:new Date(now.getTime()-d*86400000),close:100}))},now);
}
async function scan(evaluatedAt=new Date(now.getTime()-90000)) {
  return (await pool.query(`INSERT INTO collection_runs(status,trigger,started_at,finished_at,metrics) VALUES ('success','entry-test',$1,$2,$3::jsonb) RETURNING id`,
    [new Date(now.getTime()-180000),new Date(now.getTime()-60000),JSON.stringify({marketRadar:{growth:{version:'growth-opportunities-v2',evaluatedAt:evaluatedAt.toISOString(),rows:[candidate()]}}})])).rows[0].id;
}
async function setupTransition() {
  await executeCapitalPaper({now:new Date(now.getTime()-3600000),quoteFetcher:async()=>new Map(),splitChecker});
  await pool.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,quantity,price,gross_usd,fee_usd,market_at,executed_at,evidence,reason)
    VALUES ($1,'strategy','AAA','AAA','buy',20,99.95,1999,1,$2,$2,'{}','old entry'),($1,'benchmark','AAA','SPY','buy',3.998,500,1999,1,$2,$2,'{}','old benchmark')`,[CAPITAL_VERSION,new Date(now.getTime()-3600000)]);
  await pool.query('INSERT INTO paper_capital_entry_policies(account_version,entry_version,activated_at,rules) VALUES ($1,$2,$3,$4::jsonb)',
    [CAPITAL_VERSION,GROWTH_CAPITAL_ENTRY_VERSION,new Date(now.getTime()-150000),JSON.stringify(GROWTH_CAPITAL_ENTRY_RULES)]);
}
beforeEach(resetDb);
describe('forward entry transition on the original capital ledger',()=>{
  it('keeps old losses, cash and trade IDs, admits momentum only from post-activation evidence and never repeats buys',async()=>{
    await setupTransition();await scan(new Date(now.getTime()-160000));
    const old=(await pool.query('SELECT * FROM paper_capital_trades ORDER BY id')).rows;
    const fetch=async(tickers:string[])=>{const q=await quoteFetcher(tickers);if(q.has('AAA'))q.get('AAA')!.price=95;return q;};
    const blocked=await executeCapitalPaper({now,quoteFetcher:fetch,splitChecker});
    expect(blocked.sourceCurrent).toBe(false);expect(blocked.filledTrades).toBe(0);
    await scan();const admitted=await executeCapitalPaper({now,quoteFetcher:fetch,splitChecker});
    expect(admitted.entryPolicyVersion).toBe(GROWTH_CAPITAL_ENTRY_VERSION);expect(admitted.sourceCurrent).toBe(true);expect(admitted.filledTrades).toBe(2);
    expect((await executeCapitalPaper({now,quoteFetcher:fetch,splitChecker})).filledTrades).toBe(0);
    const dashboard=(await getCapitalDashboard(now))!;
    expect(dashboard.startedAt).toBe(new Date(now.getTime()-3600000).toISOString());expect(dashboard.books[0].cashUsd).toBe(16000);
    expect(dashboard.books[0].positions.find(p=>p.ticker==='AAA')!.profitUsd).toBe(-100);
    expect(dashboard.books[0].realizedProfitUsd).toBe(0);expect(dashboard.trades).toHaveLength(4);
    expect((await pool.query('SELECT * FROM paper_capital_trades WHERE id<=2 ORDER BY id')).rows).toEqual(old);
    expect((await pool.query('SELECT count(*)::int AS n FROM paper_capital_accounts')).rows[0].n).toBe(1);
    await expect(pool.query("UPDATE paper_capital_entry_policies SET activated_at=clock_timestamp()")).rejects.toThrow('immutable');
  });
  it('never uses a transition to bypass risk stop',async()=>{
    await setupTransition();await scan();await pool.query("UPDATE paper_capital_accounts SET status='risk_stopped'");
    const stopped=await executeCapitalPaper({now,quoteFetcher,splitChecker});
    expect(stopped.status).toBe('risk_stopped');expect((await getCapitalDashboard(now))!.trades.filter(t=>t.signal_ticker==='BBB')).toHaveLength(0);
  });
  it('activates explicitly and idempotently with DB time without another account or changed rules',async()=>{
    await executeCapitalPaper({now,quoteFetcher:async()=>new Map(),splitChecker});
    const first=await activateGrowthCapitalEntry(CAPITAL_VERSION);const second=await activateGrowthCapitalEntry(CAPITAL_VERSION);
    expect(second).toEqual(first);expect(first.rules).toEqual(GROWTH_CAPITAL_ENTRY_RULES);
    expect((await pool.query('SELECT count(*)::int AS n FROM paper_capital_accounts')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM paper_capital_trades')).rows[0].n).toBe(0);
    await resetDb();await executeCapitalPaper({now,quoteFetcher:async()=>new Map(),splitChecker});
    await pool.query("UPDATE paper_capital_accounts SET status='risk_stopped'");
    await expect(activateGrowthCapitalEntry(CAPITAL_VERSION)).rejects.toThrow('risk stop');
  });
});
