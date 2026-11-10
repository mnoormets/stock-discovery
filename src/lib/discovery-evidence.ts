import { collectArticleEvidence, type ArticleScan } from './article-evidence';
import { createHash } from 'node:crypto';
import { pool } from './db';
import { rssItems, xmlField, webURL, xmlText } from './discovery-feeds';
export const EVIDENCE_VERSION = 'discovery-evidence-v1';
export const WEB_QUERIES = [
  'stock earnings raises guidance when:3d',
  '(NASDAQ OR NYSE) (contract OR acquisition OR partnership) when:3d',
  '(stock OR shares) (FDA OR phase 3 OR trial results) when:3d',
  '(NASDAQ IPO OR new listing) when:3d',
];
export interface IssuerIdentity { ticker:string; name:string; cik:string; exchange:string; }
export interface FilingNotice { cik:string; name:string; form:string; filedAt:string; url:string; tickers:string[]; observedAt:string; }
export interface WebObservation { id:string; title:string; url:string; publisher:string; publishedAt:string|null; observedAt:string; query:string; tickers:string[]; }
export interface EvidenceSource { kind:string; query:string; url:string; status:'ok'|'empty'|'failed'|'disabled'; received:number; accepted:number; sha256:string|null; observedAt:string; }
export interface DiscoveryEvidence {
  version:typeof EVIDENCE_VERSION; observedAt:string; universeSize:number; universeStatus:'sec'|'stored_fallback';
  sources:EvidenceSource[]; web:WebObservation[]; filings:FilingNotice[]; filingsBeforeLimit:number;
  quoteTickers:string[]; identityConflicts:string[]; articles?:ArticleScan;
  universe?:IssuerIdentity[]; universeObservedAt?:string;
}
const day=86400000, financialForms=new Set(['10-Q','10-K','20-F','40-F']);
const cikKey=(s:string)=>/^\d{1,10}$/.test(s)?s.replace(/^0+/,''):'';
const tickerOK=(s:string)=>/^[A-Z][A-Z0-9.-]{0,14}$/.test(s);
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function parseIssuerUniverse(text:string):IssuerIdentity[] {
  const data=JSON.parse(text); if(!Array.isArray(data.fields)||!Array.isArray(data.data))throw new Error('Invalid SEC universe');
  const idx=(key:string)=>data.fields.indexOf(key);if(['cik','name','ticker','exchange'].some(k=>idx(k)<0))throw new Error('SEC universe fields missing');
  return data.data.flatMap((r:unknown[])=>{const ticker=String(r[idx('ticker')]??'').toUpperCase(),cik=String(r[idx('cik')]??''),exchange=String(r[idx('exchange')]??'');
    return tickerOK(ticker)&&cikKey(cik)&&['Nasdaq','NYSE','NYSE American','Cboe'].includes(exchange)?[{ticker,cik:cik.padStart(10,'0'),name:String(r[idx('name')]),exchange}]:[];});
}
export function matchIssuers(title:string,universe:IssuerIdentity[]):string[] {
  const tokens=new Set((title.match(/\b[A-Z][A-Z0-9.-]{1,14}\b/g)??[]).map(t=>t.replace(/[.-]+$/,'')));const lower=' '+normalized(title)+' ';
  const ambiguous=new Set(['AND','FOR','THE','ALL','ONE','NOW','NEW','USA','USD','CEO','FDA','IPO','SEC','ON','IT','IN','BE','SO','TO','AT','OR','AS','US']);
  return [...new Set(universe.filter(r=>{
    const name=normalized(r.name.replace(/\b(incorporated|inc|corporation|corp|limited|ltd|plc|holdings|company|co)\b\.?/gi,''));
    return (!ambiguous.has(r.ticker)&&tokens.has(r.ticker))||(name.length>=5&&lower.includes(' '+name+' '));
  }).map(r=>r.ticker))];
}
export function parseWebSearch(text:string,query:string,universe:IssuerIdentity[],now:Date):{received:number;rows:WebObservation[]} {
  const items=rssItems(text);const rows=items.slice(0,40).flatMap(block=>{
    const title=xmlField(block,'title'),url=webURL(xmlField(block,'link')),stamp=Date.parse(xmlField(block,'pubDate'));
    if(!url||!Number.isFinite(stamp)||stamp>now.getTime()||stamp<now.getTime()-7*day
      ||!/(stock|shares?|nasdaq|nyse|earnings|guidance|revenue|trial|FDA|approval|contract|IPO|merger|acquisition)/i.test(title))return [];
    let destination=url;const wrapper=new URL(url);if(wrapper.hostname.endsWith('bing.com')&&wrapper.searchParams.get('url'))destination=webURL(wrapper.searchParams.get('url')!)??url;
    const publisherURL=webURL(block.match(/<source\s+url="([^"]+)"/i)?.[1]??'');
    return [{id:createHash('sha256').update(destination).digest('hex'),title,url:destination,publisher:new URL(publisherURL??destination).hostname.replace(/^www\./,''),
      publishedAt:new Date(stamp).toISOString(),observedAt:now.toISOString(),query,tickers:matchIssuers(title,universe)}];
  });return {received:items.length,rows};
}
export function parseGeneralWebSearch(text:string,query:string,universe:IssuerIdentity[],now:Date):{received:number;rows:WebObservation[]} {
  if(text.length>4*1024*1024 || /captcha|anomaly-modal|verify.you.are.human/i.test(text))throw new Error('Search challenge or invalid response');
  const matches=[...text.matchAll(/<a\b([^>]*class=['"]result-link['"][^>]*)>([\s\S]*?)<\/a>/gi)];
  const rows=matches.slice(0,20).flatMap(m=>{const href=xmlText(m[1].match(/href=['"]([^'"]+)['"]/i)?.[1]??'');
    let candidate=href;try{const wrapper=new URL(href,'https://duckduckgo.com');if(wrapper.hostname.endsWith('duckduckgo.com')&&wrapper.searchParams.get('uddg'))candidate=wrapper.searchParams.get('uddg')!;}catch{return [];}
    const url=webURL(candidate),title=xmlText(m[2].replace(/<[^>]*>/g,''));if(!url||!/(stock|shares?|nasdaq|nyse|earnings|guidance|revenue|trial|FDA|approval|contract|IPO|merger|acquisition)/i.test(title))return [];
    return [{id:createHash('sha256').update(url).digest('hex'),title,url,publisher:new URL(url).hostname.replace(/^www\./,''),publishedAt:null,observedAt:now.toISOString(),query,tickers:matchIssuers(title,universe)}];
  });return {received:matches.length,rows};
}
export function parseFilingIndex(text:string,now:Date):FilingNotice[] {
  if(text.length>4*1024*1024||!/CIK\|Company Name\|Form Type\|Date Filed\|File\s?Name/i.test(text))throw new Error('Invalid SEC filing index');
  return text.split(/\r?\n/).flatMap(line=>{const [cik,name,form,date,path]=line.split('|');
    const formatted=/^\d{8}$/.test(date??'')?date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6):date;
    if(!cikKey(cik??'')||!financialForms.has(form)||!/^\d{4}-\d{2}-\d{2}$/.test(formatted??'')
      ||!/^edgar\/data\/\d+\/[\d-]+\.txt$/.test(path??'')||!Number.isFinite(Date.parse(formatted))||Date.parse(formatted)>now.getTime())return [];
    return [{cik:cik.padStart(10,'0'),name,form,filedAt:formatted,url:'https://www.sec.gov/Archives/'+path,tickers:[],observedAt:now.toISOString()}];
  });
}
export function parseFilingRSS(text:string,now:Date):FilingNotice[] {
  return rssItems(text).flatMap(block=>{const cik=xmlField(block,'edgar:cikNumber'),form=xmlField(block,'edgar:formType'),date=xmlField(block,'edgar:filingDate');
    const m=date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),filedAt=m?m[3]+'-'+m[1]+'-'+m[2]:date;
    const url=webURL(xmlField(block,'link')),published=Date.parse(xmlField(block,'pubDate'));
    if(!cikKey(cik)||!financialForms.has(form)||!url||new URL(url).hostname!=='www.sec.gov'||!Number.isFinite(Date.parse(filedAt))
      ||Date.parse(filedAt)>now.getTime()||!Number.isFinite(published)||published>now.getTime())return [];
    return [{cik:cik.padStart(10,'0'),name:xmlField(block,'edgar:companyName'),form,filedAt,url,tickers:[],observedAt:now.toISOString()}];
  });
}
export async function collectDiscoveryEvidence(options:{now?:Date;fetchText?:(url:string)=>Promise<string>;readArticle?:(url:string)=>Promise<{url:string;html:string}>}={}):Promise<DiscoveryEvidence> {
  const clock=async()=>options.now??(await pool.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
  let now=await clock();
  const known=(await pool.query('SELECT ticker,name,sec_cik FROM companies')).rows;
  const previous=(await pool.query("SELECT metrics->'discoveryEvidence' evidence FROM collection_runs WHERE metrics->'discoveryEvidence'->>'version'=$1 AND finished_at<= $2 ORDER BY id DESC LIMIT 1",[EVIDENCE_VERSION,now.toISOString()])).rows[0]?.evidence as DiscoveryEvidence|undefined;
  const snapshot:DiscoveryEvidence={version:EVIDENCE_VERSION,observedAt:now.toISOString(),universeSize:0,universeStatus:'stored_fallback',sources:[],web:[],filings:[],filingsBeforeLimit:0,quoteTickers:[],identityConflicts:[]};
  const get=options.fetchText??(async(url:string)=>{const sec=new URL(url).hostname.endsWith('sec.gov');if(sec&&!process.env.SEC_USER_AGENT)throw new Error('SEC User-Agent absent');
    const response=await fetch(url,{headers:{'User-Agent':sec?process.env.SEC_USER_AGENT!:'stock-discovery/1.0'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Source unavailable');const text=await response.text();if(text.length>4*1024*1024)throw new Error('Source too large');return text;});
  let universe:IssuerIdentity[]=known.filter(r=>cikKey(r.sec_cik??'')).map(r=>({ticker:r.ticker,name:r.name??r.ticker,cik:r.sec_cik,exchange:'stored'}));
  const universeURL='https://www.sec.gov/files/company_tickers_exchange.json';
  try {const text=await get(universeURL);universe=parseIssuerUniverse(text);snapshot.universeStatus='sec';snapshot.sources.push({kind:'universe',query:'SEC exchange/ticker inventory',url:universeURL,status:'ok',received:universe.length,accepted:universe.length,sha256:createHash('sha256').update(text).digest('hex'),observedAt:now.toISOString()});}
  catch {snapshot.sources.push({kind:'universe',query:'SEC exchange/ticker inventory',url:universeURL,status:'failed',received:0,accepted:0,sha256:null,observedAt:now.toISOString()});}
  now=await clock();snapshot.universe=universe;snapshot.universeObservedAt=now.toISOString();
  snapshot.universeSize=universe.length;
  const urls=WEB_QUERIES.map(query=>({kind:'news_search',query,url:'https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-US&gl=US&ceid=US:en'}));
  urls.push({kind:'news_search',query:'stock earnings guidance',url:'https://www.bing.com/news/search?q=stock+earnings+guidance&format=rss&mkt=en-US'});
  for(const query of ['NASDAQ stock earnings guidance','NASDAQ NYSE company contract FDA approval'])urls.push({kind:'web_search',query,url:'https://lite.duckduckgo.com/lite/?q='+encodeURIComponent(query)});
  urls.push({kind:'filing_rss',query:'Recent XBRL financial filings',url:'https://www.sec.gov/Archives/edgar/usgaap.rss.xml'});
  let cursor=new Date(now.toISOString().slice(0,10)+'T00:00:00Z');let count=0;
  while(count<3){cursor=new Date(cursor.getTime()-day);if([0,6].includes(cursor.getUTCDay()))continue;const date=cursor.toISOString().slice(0,10),quarter=Math.floor(cursor.getUTCMonth()/3)+1;
    urls.push({kind:'filing_index',query:date,url:'https://www.sec.gov/Archives/edgar/daily-index/'+cursor.getUTCFullYear()+'/QTR'+quarter+'/master.'+date.replace(/-/g,'')+'.idx'});count++;}
  await Promise.all(urls.map(async source=>{const report:EvidenceSource={...source,status:'failed',received:0,accepted:0,sha256:null,observedAt:now.toISOString()};
    try {const text=await get(source.url);const received=await clock();report.observedAt=received.toISOString();report.sha256=createHash('sha256').update(text).digest('hex');
      if(source.kind.startsWith('filing')) {const rows=source.kind==='filing_rss'?parseFilingRSS(text,received):parseFilingIndex(text,received);report.received=rows.length;report.accepted=rows.length;snapshot.filings.push(...rows);}
      else {const result=source.kind==='web_search'?parseGeneralWebSearch(text,source.query,universe,received):parseWebSearch(text,source.query,universe,received);report.received=result.received;report.accepted=result.rows.length;snapshot.web.push(...result.rows);}
      report.status=report.accepted?'ok':'empty';
    } catch { /* Keep sanitized source-level failure and continue other sources. */ }
    snapshot.sources.push(report);
  }));
  now=await clock();snapshot.observedAt=now.toISOString();
  const byCIK=new Map<string,string[]>();for(const r of universe)byCIK.set(cikKey(r.cik),[...(byCIK.get(cikKey(r.cik))??[]),r.ticker]);
  const filings=new Map<string,FilingNotice>();for(const f of [...(previous?.filings??[]),...snapshot.filings])if(Date.parse(f.filedAt)>=now.getTime()-14*day&&Date.parse(f.observedAt)<=now.getTime())filings.set(f.url,{...f,observedAt:filings.get(f.url)?.observedAt??f.observedAt,tickers:byCIK.get(cikKey(f.cik))??[]});
  snapshot.filingsBeforeLimit=filings.size;const knownCIKs=new Set(known.map(r=>cikKey(r.sec_cik??'')));
  snapshot.filings=[...filings.values()].sort((a,b)=>Number(knownCIKs.has(cikKey(b.cik)))-Number(knownCIKs.has(cikKey(a.cik)))||b.filedAt.localeCompare(a.filedAt)||a.url.localeCompare(b.url)).slice(0,1000);
  const web=new Map<string,WebObservation>();for(const w of [...(previous?.web??[]),...snapshot.web])if((w.publishedAt==null?Date.parse(w.observedAt)>=now.getTime()-7*day:Date.parse(w.publishedAt)>=now.getTime()-7*day)&&Date.parse(w.observedAt)<=now.getTime()) {const old=web.get(w.id);web.set(w.id,old&&old.observedAt<w.observedAt?old:w);}
  snapshot.web=[...web.values()].sort((a,b)=>(b.publishedAt??'').localeCompare(a.publishedAt??'')||a.id.localeCompare(b.id)).slice(0,200);
  snapshot.articles=await collectArticleEvidence(snapshot.web,previous?.articles,now,options.readArticle,clock);
  now=await clock();snapshot.observedAt=now.toISOString();
  const names=[...new Set([...snapshot.web.flatMap(w=>w.tickers),...snapshot.filings.flatMap(f=>f.tickers)])];
  const identities=new Map(universe.map(r=>[r.ticker,r.cik]));const conflicts=new Set(known.filter(r=>names.includes(r.ticker)&&r.sec_cik&&identities.has(r.ticker)&&cikKey(r.sec_cik)!==cikKey(identities.get(r.ticker)!)).map(r=>r.ticker));snapshot.identityConflicts=[...conflicts];
  const attempted=(await pool.query("SELECT x ticker,max(r.finished_at) at FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.metrics->'marketRadar'->'sourceDiscovery'->'requested','[]'::jsonb)) x WHERE r.status='success' AND r.finished_at<=$1 GROUP BY x",[now.toISOString()])).rows;
  const ages=new Map(attempted.map(r=>[r.ticker,new Date(r.at).getTime()]));const webNames=new Set(snapshot.web.flatMap(w=>w.tickers));
  snapshot.quoteTickers=names.filter(t=>!conflicts.has(t)).sort((a,b)=>(ages.get(a)??0)-(ages.get(b)??0)||Number(webNames.has(b))-Number(webNames.has(a))||a.localeCompare(b)).slice(0,10);
  snapshot.sources.sort((a,b)=>a.url.localeCompare(b.url));return snapshot;
}
