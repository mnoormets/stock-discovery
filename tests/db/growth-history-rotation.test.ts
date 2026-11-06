import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { collectGrowthOpportunities } from '../../src/lib/growth-opportunities';
import type { GrowthOpportunitySnapshot } from '../../src/lib/growth-opportunities';
import type { MarketRadarSnapshot, MarketRadarStock } from '../../src/lib/market-radar';
import { makePoint } from '../fixtures/financials';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);
const now=new Date('2026-11-06T16:00:00Z');
const period={periodStart:'2026-01-01',periodEnd:'2026-06-30',periodKind:'ytd' as const,filedAt:'2026-08-05',accessionNumber:'same'};
const facts=(revenue=150)=>[makePoint('revenue',revenue,period),makePoint('revenue',100,{...period,periodStart:'2025-01-01',periodEnd:'2025-06-30'}),makePoint('operating_cash_flow',10,period)];
const stock=(ticker:string):MarketRadarStock=>({ticker,name:ticker,price:110,marketAt:now.toISOString(),changePercent:1,marketCap:1e9,volume:100,relativeVolume:1,channels:['growth_technology_stocks'],warnings:[]});
const radar=(names:string[]):MarketRadarSnapshot=>({version:'market-radar-v1',observedAt:now.toISOString(),channels:[],stocks:names.map(stock)});
const chart=async(ticker:string)=>({meta:{symbol:ticker,currency:'USD'},quotes:[30,90,180].map(d=>({date:new Date(now.getTime()-d*86400000),close:100}))});
async function prior(rows:object[],at:Date,status='success') {
 await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,error_message,metrics) VALUES('test',$1,$2,$2,0,$3,$4::jsonb)`,[status,at.toISOString(),status==='failure'?'synthetic failure':null,JSON.stringify({marketRadar:{growth:{version:'growth-opportunities-v2',evaluatedAt:at.toISOString(),rows}}})]);
}

describe('growth history work rotation',()=>{
 it('checks a never-attempted lower-growth name before repeatedly checked higher-growth names within the same cap',async()=>{
  const high=Array.from({length:20},(_,i)=>'H'+String(i).padStart(2,'0'));
  await prior(high.map(ticker=>({ticker,historyAttempted:true})),new Date(now.getTime()-86400000));
  const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
  const names=[...high,'NEVER'],financials=new Map(names.map(t=>[t,facts(t==='NEVER'?125:150)]));const calls:string[]=[];
  const result=await collectGrowthOpportunities(radar(names),now,financials,async ticker=>{calls.push(ticker);return chart(ticker);});
  expect(calls[0]).toBe('NEVER');expect(calls).toHaveLength(20);
  expect(result).toMatchObject({historyAttempted:20,historyDeferred:1,historySelectionVersion:'least-recently-attempted-v1'});
  expect(result.rows.find(r=>r.ticker==='NEVER')).toMatchObject({state:'early',historyAttempted:true,previousHistoryAttemptAt:null});
  expect(result.rows.find(r=>r.ticker==='H19')).toMatchObject({state:'unknown',historyAttempted:false});
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(before);
  expect((await pool.query('SELECT count(*)::int n FROM paper_capital_trades')).rows[0].n).toBe(0);
 });

 it('records failed attempts, recognizes legacy stored history and ignores deferred, failed-run and future evidence',async()=>{
  await prior([{ticker:'OLDER',historyAttempted:true},{ticker:'LEGACY',priceObservations:[]}],new Date(now.getTime()-2*86400000));
  await prior([{ticker:'FAILED',historyAttempted:true}],new Date(now.getTime()-86400000));
  await prior([{ticker:'UNTRIED',historyAttempted:false,priceObservations:[]}],new Date(now.getTime()-3600000));
  await prior([{ticker:'UNTRIED',historyAttempted:true}],new Date(now.getTime()+86400000));
  await prior([{ticker:'UNTRIED',historyAttempted:true}],new Date(now.getTime()-3*86400000),'failure');
  const names=['FAILED','LEGACY','OLDER','UNTRIED'],calls:string[]=[];
  const result=await collectGrowthOpportunities(radar(names),now,new Map(names.map(t=>[t,facts()])),async ticker=>{calls.push(ticker);if(ticker==='FAILED')throw Error('unavailable');return chart(ticker);});
  expect(calls).toEqual(['UNTRIED','LEGACY','OLDER','FAILED']);
  expect(result.rows.find(r=>r.ticker==='FAILED')).toMatchObject({state:'unknown',historyAttempted:true});
 });

 it('rotates deferred names on the next scan while retaining the 20-attempt limit and first snapshots',async()=>{
  const names=Array.from({length:21},(_,i)=>'S'+String(i).padStart(2,'0')),financials=new Map(names.map(t=>[t,facts()]));
  const first=await collectGrowthOpportunities(radar(names),now,financials,chart);
  await prior(first.rows,now);
  const original=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;
  const calls:string[]=[];const second:GrowthOpportunitySnapshot=await collectGrowthOpportunities(radar(names),new Date(now.getTime()+60000),financials,async ticker=>{calls.push(ticker);return chart(ticker);});
  expect(calls[0]).toBe('S20');expect(calls).toHaveLength(20);expect(second.historyDeferred).toBe(1);
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows).toEqual(original);
  expect((await pool.query('SELECT count(*)::int n FROM paper_strategy_orders')).rows[0].n).toBe(0);
 });
});
