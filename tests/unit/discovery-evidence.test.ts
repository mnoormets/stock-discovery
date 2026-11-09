import { normalizeMarketRadarRows } from '../../src/lib/market-radar';
import { describe,expect,it } from 'vitest';
import { parseIssuerUniverse,matchIssuers,parseWebSearch,parseFilingIndex,parseFilingRSS,parseGeneralWebSearch } from '../../src/lib/discovery-evidence';
const now=new Date('2026-11-09T17:00:00Z');
const issuers=[{ticker:'ACME',name:'Acme Therapeutics Inc.',cik:'0000000001',exchange:'Nasdaq'}];
describe('multi-source discovery parsing and evidence',()=>{
 it('links registered issuers, keeps unknown mentions unresolved and rejects unsupported exchange inventory',()=>{
  expect(parseIssuerUniverse(JSON.stringify({fields:['cik','name','ticker','exchange'],data:[[1,'Acme','ACME','Nasdaq'],[2,'OTC','BAD','OTC']]}))).toHaveLength(1);
  expect(matchIssuers('Acme Therapeutics stock wins FDA approval',issuers)).toEqual(['ACME']);expect(matchIssuers('UNKNOWN shares rise',issuers)).toEqual([]);
 });
 it('retains query/source/publish/receipt evidence and excludes irrelevant, old, future and unsafe results',()=>{
  const item=(title:string,date:string,url='https://example.com/news')=>'<item><title><![CDATA['+title+']]></title><link>'+url+'</link><pubDate>'+date+'</pubDate></item>';
  const xml='<rss><channel>'+item('ACME stock earnings','Mon, 09 Nov 2026 16:00:00 GMT')+item('School classes','Mon, 09 Nov 2026 16:00:00 GMT')+item('ACME shares old','Mon, 02 Nov 2020 16:00:00 GMT')+item('ACME stock future','Tue, 10 Nov 2026 16:00:00 GMT')+item('ACME stock unsafe','Mon, 09 Nov 2026 16:00:00 GMT','javascript:alert(1)')+'</channel></rss>';
  const r=parseWebSearch(xml,'earnings',issuers,now);expect(r.received).toBe(5);expect(r.rows).toHaveLength(1);expect(r.rows[0]).toMatchObject({tickers:['ACME'],query:'earnings',publishedAt:'2026-11-09T16:00:00.000Z',observedAt:now.toISOString()});
 });
 it('reads official financial filing indexes and ignores future, unrelated or invalid rows',()=>{
  const header='CIK|Company Name|Form Type|Date Filed|File Name\n';
  const r=parseFilingIndex(header+'1|Acme|10-Q|20261106|edgar/data/1/0000000001-26-000001.txt\n2|Other|4|20261106|edgar/data/2/0000000002-26-000001.txt\n1|Future|10-Q|20261110|edgar/data/1/0000000001-26-000002.txt',now);
  expect(r).toHaveLength(1);expect(r[0]).toMatchObject({cik:'0000000001',filedAt:'2026-11-06',form:'10-Q'});expect(()=>parseFilingIndex('bad',now)).toThrow();
 });
 it('validates namespace filing RSS and does not fabricate a financial event from ordinary items',()=>{
  const valid='<item><link>https://www.sec.gov/Archives/a</link><pubDate>Mon, 9 Nov 2026 11:00:00 EST</pubDate><edgar:cikNumber>1</edgar:cikNumber><edgar:formType>10-Q</edgar:formType><edgar:filingDate>11/09/2026</edgar:filingDate><edgar:companyName>Acme</edgar:companyName></item>';
  expect(parseFilingRSS('<rss>'+valid+'</rss>',now)[0]).toMatchObject({cik:'0000000001',form:'10-Q'});expect(parseFilingRSS('<rss><item><title>Rumor</title></item></rss>',now)).toEqual([]);
 });
});

describe('general public web search',()=>{it('keeps unknown publication time explicit, unwraps links safely and stops on access challenges',()=>{
 const html='<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstock" class="result-link">ACME stock earnings</a>';
 const r=parseGeneralWebSearch(html,'stock',issuers,now);expect(r.rows[0]).toMatchObject({url:'https://example.com/stock',publishedAt:null,tickers:['ACME']});
 expect(()=>parseGeneralWebSearch('anomaly-modal captcha','stock',issuers,now)).toThrow();
});});


describe('source-discovered security classification',()=>{it('rejects units, rights and warrants before adding source stocks to the common-equity radar',()=>{
 const quote={symbol:'TEST',quoteType:'EQUITY',currency:'USD',exchange:'NMS',regularMarketPrice:100,regularMarketTime:now};
 for(const longName of ['Acme Units','Acme Warrants','Acme Rights','Acme Preferred Stock'])expect(normalizeMarketRadarRows({quotes:[{...quote,longName}]},'source_discovery',now)).toHaveLength(0);
 expect(normalizeMarketRadarRows({quotes:[{...quote,longName:'Preferred Bank'}]},'source_discovery',now)).toHaveLength(1);
});});
