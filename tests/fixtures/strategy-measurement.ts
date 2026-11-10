import type { KnownFact, ResearchMember, ResearchInputs } from '../../src/lib/strategy-signal-evaluation';
export const frozenAt='2026-11-10T15:00:00.000Z';
export function researchFacts():KnownFact[] {
 const point=(id:number,metric:KnownFact['metric'],value:number,start:string|null,end:string,unit='USD'):KnownFact=>({
  id,metric,value,unit,periodStart:start,periodEnd:end,periodKind:start?'ytd':'instant',fiscalYear:null,fiscalPeriod:null,form:'10-Q',
  filedAt:'2026-11-09',accessionNumber:'0001-26-000001',taxonomy:unit==='shares'?'dei':'us-gaap',tag:unit==='shares'?'EntityCommonStockSharesOutstanding':metric,
  derived:false,sourceUrl:'https://www.sec.gov/Archives/edgar/data/1/a.txt',knownAt:'2026-11-10T14:00:00.000Z'});
 return [point(1,'revenue',125,'2026-01-01','2026-09-30'),point(2,'revenue',100,'2025-01-01','2025-09-30'),
  point(3,'operating_cash_flow',10,'2026-01-01','2026-09-30'),point(4,'shares_outstanding',100,null,'2026-09-30','shares'),
  point(5,'shares_outstanding',99,null,'2025-09-30','shares')];
}
export function researchMember(ticker='KNOWN',id='1'):ResearchMember {
 const cik=id.padStart(10,'0');return {key:ticker+'|'+cik,ticker,name:ticker+' Inc.',cik,companyId:id,inInventory:true,discoverySources:['sec_inventory'],
  discoveredAt:'2026-10-01T12:00:00.000Z',identityKnownAt:'2026-11-10T14:00:00.000Z',storedCIK:cik,quoteType:'EQUITY',currency:'USD',exchange:'NMS',
  marketCapUSD:1e9,marketCapKnownAt:'2026-11-10T14:00:00.000Z',marketCapMarketAt:'2026-11-10T14:00:00.000Z',facts:researchFacts(),availableFactCount:5};
}
export function researchInput(members=[researchMember()]):ResearchInputs {
 return {collectionId:1,collectionStartedAt:'2026-11-10T14:50:00.000Z',frozenAt,inventoryObservedAt:'2026-11-10T14:51:00.000Z',
 inventoryStatus:'complete_inventory',inventoryCount:members.length,members,filings:[{cik:'0000000001',name:'Known Inc.',form:'10-Q',filedAt:'2026-11-10',
 url:'https://www.sec.gov/Archives/edgar/data/1/a.txt',tickers:['KNOWN'],observedAt:'2026-11-10T14:55:00.000Z'}],priorEventKeys:[]};
}
