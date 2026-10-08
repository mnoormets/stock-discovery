import { describe, expect, it } from 'vitest';
import { discoverListingRows, analyzeListing, type ListingSnapshot } from '../../src/lib/nasdaq-listings';
import { makePoint } from '../fixtures/financials';
const now=new Date('2026-10-08T16:00:00Z');
const directory=(rows:string[])=>['Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',...rows,'File Creation Time: 1008202612:00'].join('\n');
const actions=(rows:string[])=>['Symbol|Company Name|NASDAQ Action|BX Action|PSX Action|Effective Date|Primary Listing Market',...rows,'File Creation Time: 1008202612:00'].join('\n');
const common=(ticker:string)=>`${ticker}|${ticker} Common Stock|Q|N|N|100|N|N`;
function previous(text:string):ListingSnapshot{return{version:'nasdaq-listing-research-v1',observedAt:now.toISOString(),status:'ok',error:null,directoryText:text,actionsText:null,sources:[],baseline:true,previousObservedAt:null,rows:[],quoteAttempted:0,quoteDeferred:0};}
describe('new Nasdaq listing discovery',()=>{
  it('never calls existing baseline members new but retains dated primary Add observations',()=>{
    const text=directory([common('OLD'),common('NEW')]);
    expect(discoverListingRows(text,actions([]),null,now).rows).toEqual([]);
    const scan=discoverListingRows(text,actions(['NEW|New|Add|||10/08/2026|Q','OTHER|Other|Add|||10/08/2026|N']),null,now);
    expect(scan.rows.map(r=>r.ticker)).toEqual(['NEW']);expect(scan.rows[0].eligibility).toBe('lookup_ready');
  });
  it('diffs complete directories and preserves first observation while checking instrument and effective dates',()=>{
    const old=previous(directory([common('OLD')]));
    const scan=discoverListingRows(directory([common('OLD'),common('NEW'),'WARR|New Warrants|Q|N|N|100|N|N','SPAC|New Acquisition Common Stock|Q|N|N|100|N|N',common('FUT')]),actions(['FUT|Future|Add|||10/09/2026|Q']),old,now);
    expect(scan.rows.find(r=>r.ticker==='WARR')?.eligibility).toBe('excluded');expect(scan.rows.find(r=>r.ticker==='SPAC')?.eligibility).toBe('radar_only');expect(scan.rows.find(r=>r.ticker==='FUT')?.eligibility).toBe('pending');
    const p={...old,rows:scan.rows,directoryText:directory([common('OLD'),common('NEW')])};
    const repeated=discoverListingRows(p.directoryText,actions([]),p,new Date(now.getTime()+60000));
    expect(repeated.rows.find(r=>r.ticker==='NEW')?.firstObservedAt).toBe(now.toISOString());
  });
  it('rejects broken/stale source files and blocks deletions without hiding their history',()=>{
    expect(()=>discoverListingRows('broken',actions([]),null,now)).toThrow();
    expect(()=>discoverListingRows(directory([]).replace('10082026','09012026'),actions([]),null,now)).toThrow();
    const p=previous(directory([]));p.rows=discoverListingRows(directory([common('NEW')]),actions([]),p,now).rows;
    expect(discoverListingRows(directory([common('NEW')]),actions(['NEW|New|Delete|||10/08/2026|Q']),p,now).rows[0].eligibility).toBe('excluded');
  });
  it('can analyze a new listing without invented long price history; unknown/future filing stays unknown',()=>{
    const row=discoverListingRows(directory([common('NEW')]),actions(['NEW|New|Add|||10/08/2026|Q']),null,now).rows[0];row.price=10;row.marketAt=now.toISOString();
    const period={periodStart:'2025-01-01',periodEnd:'2025-12-31',periodKind:'annual' as const,filedAt:'2026-02-01',accessionNumber:'same'};
    const facts=[makePoint('revenue',150,period),makePoint('revenue',100,{...period,periodStart:'2024-01-01',periodEnd:'2024-12-31'}),makePoint('operating_cash_flow',10,period)];
    expect(analyzeListing(row,facts,now).analysis).toBe('research');expect(analyzeListing(row,[],now).analysis).toBe('unknown');
    expect(analyzeListing(row,facts.map(f=>({...f,filedAt:'2026-10-09'})),now).analysis).toBe('unknown');
    facts[2].value=-1;expect(analyzeListing(row,facts,now).analysis).toBe('weak');
  });
});
