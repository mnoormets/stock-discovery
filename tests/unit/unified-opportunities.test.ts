import {describe,it,expect} from 'vitest';
import {buildUnifiedOpportunities} from '../../src/lib/opportunity-book';
import type {DiscoveryEvidence} from '../../src/lib/discovery-evidence';
import type {MarketRadarSnapshot} from '../../src/lib/market-radar';
import type {ListingSnapshot} from '../../src/lib/nasdaq-listings';
describe('unified discovery evidence',()=>{it('joins independent discovery reasons without turning unknown-dated mentions or conflicted identities into qualified entries',()=>{
 const at='2026-11-09T18:00:00Z';
 const web=(ticker:string,publisher:string,publishedAt:string|null)=>({ticker,tickers:[ticker],publisher,publishedAt,observedAt:at,url:'https://'+publisher+'/stock',id:publisher,query:'stock',title:ticker+' stock'});
 const evidence={version:'discovery-evidence-v1',identityConflicts:['BAD'],filings:[{tickers:['MRNA','NOPRICE','BAD'],url:'https://www.sec.gov/filing'}],web:[web('MRNA','one.test',at),web('MRNA','two.test',at),web('UNKNOWN','a.test',null),web('UNKNOWN','b.test',null)]} as unknown as DiscoveryEvidence;
 const radar={stocks:[{ticker:'MRNA',name:'Moderna',price:250,marketAt:at},{ticker:'BAD',price:10,marketAt:at}],growth:{rows:[{ticker:'MRNA',state:'excluded',revenueGrowth:40,facts:[{value:1},{value:1},{value:-1}]}],priceMomentum:{rows:[{ticker:'MRNA',state:'observe'}]}}} as unknown as MarketRadarSnapshot;
 const snapshot=buildUnifiedOpportunities(evidence,radar,{rows:[]} as unknown as ListingSnapshot,new Date(at));
 expect(snapshot.rows).toHaveLength(2);expect(snapshot.rows.find(x=>x.ticker==='MRNA')).toMatchObject({state:'qualified_research',financialPass:false,sources:['price_momentum','financial_filing','multiple_publisher_mentions']});
 expect(snapshot.rows.find(x=>x.ticker==='NOPRICE')?.state).toBe('price_unavailable');expect(snapshot.rows.some(x=>['BAD','UNKNOWN'].includes(x.ticker))).toBe(false);
});});
