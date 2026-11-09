import {describe,it,expect} from 'vitest';
import {buildCandidates} from '../../src/lib/discovery';
import {mergeCollectedMarketQuotes,type MarketRadarSnapshot} from '../../src/lib/market-radar';
import type {Fundamentals} from '../../src/lib/types';
const now=new Date('2026-11-09T18:00:00Z');
const fundamental=(ticker:string):Fundamentals=>({ticker,name:ticker+' Corp',source:'yahoo',price:44,marketAt:now.toISOString(),currency:'USD',marketCap:50e9,researchQuote:{quoteType:'EQUITY',exchange:'NMS',changePercent:2,volume:200,averageVolume:100}});
const snapshot=():MarketRadarSnapshot=>({version:'market-radar-v1',observedAt:now.toISOString(),stocks:[],channels:[]});
describe('all common stocks and collected quote bridge',()=>{
 it('allows big, familiar and reference companies through the same social filter while excluding funds',()=>{
 const tickers=['AMD','PLTR','RKLB','NVDA','SMALL','SPY','TQQQ','FUND'];
 const rows=tickers.map((ticker,i)=>({ticker,name:ticker==='FUND'?'Example ETF':ticker,rank:i+1,mentions:20,upvotes:20,rank_24h_ago:10,mentions_24h_ago:10}));
 const funds=new Map(tickers.map(t=>[t,{...fundamental(t),isFund:t==='FUND'}]));
 expect(buildCandidates(rows,new Map(),funds,new Map(),new Set()).map(x=>x.ticker).sort()).toEqual(['AMD','NVDA','PLTR','RKLB','SMALL']);
 });
 it('keeps every validated lookup beyond the screen 25-row cap, including missing prices, without inferring classification',()=>{
 const s=snapshot(),funds=new Map(Array.from({length:30},(_,i)=>{const t='NAME'+i;return[t,fundamental(t)]}));
 funds.set('RKLB',fundamental('RKLB'));funds.set('STALE',{...fundamental('STALE'),marketAt:'2026-10-01T00:00:00Z'});
 funds.set('UNKNOWN',{ticker:'UNKNOWN',price:10,source:'yahoo'});funds.set('ETF',{...fundamental('ETF'),researchQuote:{...fundamental('ETF').researchQuote!,quoteType:'ETF'}});
 funds.set('FOREIGN',{...fundamental('FOREIGN'),researchQuote:{...fundamental('FOREIGN').researchQuote!,exchange:'LSE'}});
 funds.set('PAID',{...fundamental('PAID'),source:'fmp'});
 mergeCollectedMarketQuotes(s,funds,now);expect(s.stocks).toHaveLength(32);expect(s.stocks.find(x=>x.ticker==='RKLB')).toMatchObject({price:44,changePercent:2,relativeVolume:2,channels:['collection_lookup']});
 expect(s.stocks.find(x=>x.ticker==='STALE')?.price).toBeNull();expect(s.inputVersion).toBe('all-collected-us-equities-v1');
 });
 it('deduplicates against screen observations and keeps the newest valid price with both source reasons',()=>{
 const s=snapshot();mergeCollectedMarketQuotes(s,new Map([['RKLB',fundamental('RKLB')]]),now);
 s.stocks[0].channels=['day_gainers'];s.stocks[0].price=45;
 mergeCollectedMarketQuotes(s,new Map([['RKLB',{...fundamental('RKLB'),price:30,marketAt:'2026-11-09T17:59:00Z'}]]),now);
 expect(s.stocks).toHaveLength(1);expect(s.stocks[0]).toMatchObject({price:45,channels:['day_gainers','collection_lookup']});
 });
});
