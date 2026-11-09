import {beforeEach,describe,it,expect,vi} from 'vitest';
import {pool} from '../../src/lib/db';
import {resetDb} from '../setup/reset';
import {fetchFundamentals} from '../../src/lib/yahoo';
import {collectMarketRadar} from '../../src/lib/market-radar';
import * as financials from '../../src/lib/company-financials';
const provider=vi.hoisted(()=>({at:new Date(),calls:0}));
vi.mock('yahoo-finance2',()=>({default:class{
 async quote(){provider.calls++;return [{symbol:'RKLB',longName:'Rocket Lab Corp',quoteType:'EQUITY',exchange:'NMS',currency:'USD',regularMarketPrice:44,regularMarketTime:provider.at,regularMarketChangePercent:2,regularMarketVolume:200,averageDailyVolume3Month:100,marketCap:50e9}];}
 async screener(){return {quotes:[]};}
 async chart(){return {meta:{symbol:'RKLB',currency:'USD'},quotes:[]};}
}}));
beforeEach(async()=>{vi.restoreAllMocks();await resetDb();provider.calls=0;provider.at=new Date((await pool.query('SELECT clock_timestamp() now')).rows[0].now.getTime()-120000);});
describe('existing lookup to real radar persistence',()=>{it('uses one existing quote request, preserves its metadata and timestamp, and never needs a screen/search match',async()=>{
 vi.spyOn(financials,'enrichStoredCompanyFinancials').mockResolvedValue({status:'disabled',financialUniverse:0,coveredBefore:0,coveredAfter:0,attempted:0,enriched:0,unavailable:0,failed:0,dailyLimit:20,attemptedTodayBefore:0,dailyRemaining:20,attemptedTickers:[],unavailableTickers:[],failedTickers:[]});
 const f=await fetchFundamentals(['RKLB']);const s=await collectMarketRadar([],[],f);expect(provider.calls).toBe(1);expect(s.stocks[0]).toMatchObject({ticker:'RKLB',price:44,changePercent:2,channels:['collection_lookup']});expect(s.growth?.rows[0].state).toBe('unknown');
 await collectMarketRadar([],[],f);expect(provider.calls).toBe(1);expect((await pool.query('SELECT market_at FROM price_snapshots')).rows).toEqual([{market_at:provider.at}]);
 for(const t of ['paper_capital_trades','paper_strategy_orders','unified_opportunity_paper'])expect((await pool.query('SELECT count(*)::int n FROM '+t)).rows[0].n).toBe(0);
});});
