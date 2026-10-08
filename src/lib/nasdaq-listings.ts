import { pool, resolveCollectionCompanyIds } from './db';
import { fetchExecutionQuotes, type YahooExecutionQuote } from './yahoo';
import { newYorkPriceDate, priceObservationRecency } from './price-observation';
import { getAllStoredCompanyFinancials, enrichStoredCompanyFinancials, type FinancialPoint } from './company-financials';
import { selectGrowthEvidence } from './growth-opportunities';
import type { Fundamentals } from './types';
const source = require('../../scripts/_nasdaq-listings.cjs');
export const NASDAQ_RESEARCH_VERSION = 'nasdaq-listing-research-v1';
const DAY = 86400000;
export interface ListingRow {
  ticker: string; name: string; effectiveDate: string | null;
  origin: 'trading_add' | 'directory_add'; firstObservedAt: string;
  eligibility: string; reasons: string[]; firstPrice: number | null;
  firstPriceAt: string | null; priceObservedAt: string | null; lookupAt: string | null;
  price: number | null; marketAt: string | null; facts: FinancialPoint[];
  revenueGrowth: number | null; analysis: 'research' | 'weak' | 'unknown';
}
export interface ListingSnapshot {
  version: string; observedAt: string; status: 'ok' | 'failed'; error: string | null;
  directoryText: string | null; actionsText: string | null;
  sources: Array<{ url: string; sha256: string; fileDate: string }>;
  baseline: boolean; previousObservedAt: string | null; rows: ListingRow[];
  quoteAttempted: number; quoteDeferred: number;
  financialEnrichment?: { attempted: number; dailyRemaining: number };
}
export function discoverListingRows(directoryText: string, actionsText: string, previous: ListingSnapshot | null, now: Date) {
  const directory = source.parseNasdaqListed(directoryText);
  const actions = source.parseAddsDeletes(actionsText);
  const day = newYorkPriceDate(now.toISOString())!;
  for (const file of [directory, actions]) {
    const age = (Date.parse(day) - Date.parse(file.fileCreation.date)) / DAY;
    if (age < -1 || age > 4) throw new Error('Nasdaq source date is stale or future; timestamp timezone is not declared.');
  }
  const prior = previous?.directoryText ? source.parseNasdaqListed(previous.directoryText) : null;
  const diff = source.diffDirectories(prior?.rows ?? null, directory.rows);
  const bySymbol = new Map<string, any>(directory.rows.map((r: any) => [r.symbol, r]));
  const rows = new Map<string, ListingRow>();
  for (const old of previous?.rows ?? []) if (now.getTime() - Date.parse(old.firstObservedAt) <= 30 * DAY) rows.set(old.ticker, { ...old });
  const add = (ticker: string, name: string, effectiveDate: string | null, origin: ListingRow['origin']) => {
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) || rows.has(ticker)) return;
    rows.set(ticker, { ticker, name, effectiveDate, origin, firstObservedAt: now.toISOString(),
      eligibility: 'pending', reasons: [], firstPrice: null, firstPriceAt: null, priceObservedAt: null,
      lookupAt: null, price: null, marketAt: null, facts: [], revenueGrowth: null, analysis: 'unknown' });
  };
  for (const event of actions.rows) {
    if (event.nasdaqAction !== 'Add' || !['Q','G','S'].includes(event.primaryListingMarket)) continue;
    const age = (Date.parse(day) - Date.parse(event.effectiveDate)) / DAY;
    if (age >= -7 && age <= 30) add(event.symbol,event.companyName,event.effectiveDate,'trading_add');
  }
  for (const row of diff.added) add(row.symbol,row.securityName,null,'directory_add');
  for (const row of rows.values()) {
    const current = bySymbol.get(row.ticker);
    row.price=null; row.marketAt=null; row.facts=[]; row.revenueGrowth=null; row.analysis='unknown';
    if (actions.rows.some((e: any)=>e.symbol===row.ticker && e.nasdaqAction==='Delete' && e.effectiveDate<=day)) {
      row.eligibility='excluded'; row.reasons=['Trading-system deletion observed; no current research entry.'];
    } else if (row.effectiveDate && row.effectiveDate > day) {
      row.eligibility='pending'; row.reasons=['Announced effective date has not arrived.'];
    } else if (!current) {
      row.eligibility='pending'; row.reasons=['Not confirmed in the current Nasdaq directory.'];
    } else {
      const classification = source.classifyDirectorySecurity(current);
      row.name=current.securityName; row.eligibility=classification.eligibility; row.reasons=[...classification.reasons];
      const event=actions.rows.find((e: any)=>e.symbol===row.ticker && e.nasdaqAction==='Add');
      if (row.origin==='trading_add' && event) {
        const check=source.classifyTradingEvent(event,bySymbol); row.eligibility=check.status; row.reasons=[...check.reasons];
      }
    }
  }
  return { rows:[...rows.values()].sort((a,b)=>a.firstObservedAt.localeCompare(b.firstObservedAt)||a.ticker.localeCompare(b.ticker)), baseline:!prior,
    sources:[{url:source.NASDAQ_LISTED_URL,sha256:directory.contentSha256,fileDate:directory.fileCreation.date},
      {url:source.NASDAQ_ADDS_DELETES_URL,sha256:actions.contentSha256,fileDate:actions.fileCreation.date}] };
}
export function analyzeListing(row: ListingRow, points: FinancialPoint[], now: Date): ListingRow {
  const result={...row,facts:[] as FinancialPoint[],revenueGrowth:null as number|null,analysis:'unknown' as ListingRow['analysis'],reasons:[...row.reasons]};
  if (row.eligibility!=='lookup_ready') return result;
  if (row.price==null || priceObservationRecency(row.marketAt,now.toISOString())!=='recent') {
    result.reasons.push('Usable USD price unavailable; valuation unknown.'); return result;
  }
  result.facts=selectGrowthEvidence(points,new Date(row.marketAt!));
  if (result.facts.length!==3) {
    result.reasons.push('Comparable recent same-filing USD revenue and operating cash flow unavailable.'); return result;
  }
  const [revenue,previous,cash]=result.facts;
  if (previous.value>0 && revenue.value>0) result.revenueGrowth=(revenue.value/previous.value-1)*100;
  result.analysis=result.revenueGrowth!=null && result.revenueGrowth>=25 && cash.value>0?'research':'weak';
  result.reasons.push(result.analysis==='research'?'Revenue growth at least 25% and positive same-period OCF: research further.':'Growth/cash-flow research checks not met.');
  return result;
}
export async function collectNasdaqListings(options: { fetchText?: (url:string)=>Promise<string>; quoteFetcher?:typeof fetchExecutionQuotes; enrich?:typeof enrichStoredCompanyFinancials }={}): Promise<ListingSnapshot> {
  const clock=async()=>(await pool.query<{now:Date}>('SELECT clock_timestamp() AS now')).rows[0].now;
  const previous=(await pool.query(`SELECT metrics->'nasdaqListings' AS snapshot FROM collection_runs
    WHERE status='success' AND metrics->'nasdaqListings'->>'version'=$1 AND metrics->'nasdaqListings'->>'status'='ok'
    ORDER BY id DESC LIMIT 1`,[NASDAQ_RESEARCH_VERSION])).rows[0]?.snapshot as ListingSnapshot??null;
  let now=await clock();
  const snapshot:ListingSnapshot={version:NASDAQ_RESEARCH_VERSION,observedAt:now.toISOString(),status:'failed',error:null,
    directoryText:null,actionsText:null,sources:[],baseline:!previous,previousObservedAt:previous?.observedAt??null,rows:[],quoteAttempted:0,quoteDeferred:0};
  try {
    [snapshot.directoryText,snapshot.actionsText]=await Promise.all([(options.fetchText??source.fetchNasdaqText)(source.NASDAQ_LISTED_URL),(options.fetchText??source.fetchNasdaqText)(source.NASDAQ_ADDS_DELETES_URL)]);
    now=await clock(); snapshot.observedAt=now.toISOString();
    Object.assign(snapshot,discoverListingRows(snapshot.directoryText,snapshot.actionsText,previous,now));
  } catch { snapshot.error='Nasdaq sources unavailable, stale or invalid; no new-listing inference made.'; return snapshot; }
  const eligible=snapshot.rows.filter(r=>r.eligibility==='lookup_ready');
  for (const row of eligible) await pool.query(`INSERT INTO companies(ticker,name,source) VALUES($1,$2,'nasdaq-listing-research-v1') ON CONFLICT(ticker) DO NOTHING`,[row.ticker,row.name]);
  // Establish missing first prices only; follow-up quotes share the existing 50/day tracking budget.
  const pending=eligible.filter(r=>r.firstPrice==null).sort((a,b)=>(a.lookupAt??'').localeCompare(b.lookupAt??'')||a.firstObservedAt.localeCompare(b.firstObservedAt)||a.ticker.localeCompare(b.ticker));
  const selected=pending.slice(0,20); snapshot.quoteAttempted=selected.length; snapshot.quoteDeferred=Math.max(0,pending.length-20);
  let quotes=new Map<string,YahooExecutionQuote>();
  try { quotes=await(options.quoteFetcher??fetchExecutionQuotes)(selected.map(r=>r.ticker)); }
  catch { for(const row of selected)row.reasons.push('Yahoo initial quote request failed.'); }
  now=await clock(); const fundamentals=new Map<string,Fundamentals>();
  for(const row of selected){row.lookupAt=now.toISOString();const q=quotes.get(row.ticker);
    if(!q||q.ticker!==row.ticker||q.currency!=='USD'||q.price==null||!Number.isFinite(q.price)||q.price<=0
      ||priceObservationRecency(q.marketTime,now.toISOString())!=='recent'||(row.effectiveDate&&newYorkPriceDate(q.marketTime!)!<row.effectiveDate)){
      row.reasons.push('Initial quote missing, stale, future, non-USD or before effective date.');continue;}
    row.firstPrice=q.price;row.firstPriceAt=q.marketTime;row.priceObservedAt=now.toISOString();
    fundamentals.set(row.ticker,{ticker:row.ticker,name:row.name,price:q.price,marketAt:q.marketTime,currency:'USD',source:'yahoo'});
  }
  await resolveCollectionCompanyIds(fundamentals.keys(),fundamentals);
  if (eligible.length) {
    const enriched=await(options.enrich??enrichStoredCompanyFinancials)(20);
    snapshot.financialEnrichment={attempted:enriched.attempted,dailyRemaining:enriched.dailyRemaining};
  }
  now=await clock();
  const stored=await pool.query(`SELECT c.ticker,p.price,p.market_at FROM companies c LEFT JOIN LATERAL
    (SELECT price,market_at FROM price_snapshots WHERE company_id=c.id AND currency='USD' AND market_at<=$2 AND captured_at<=$2
      ORDER BY market_at DESC,captured_at DESC LIMIT 1)p ON true WHERE c.ticker=ANY($1::text[])`,[eligible.map(r=>r.ticker),now.toISOString()]);
  const prices=new Map(stored.rows.map(r=>[r.ticker,r]));const facts=new Map((await getAllStoredCompanyFinancials(true)).map(r=>[r.ticker,r.facts??[]]));
  snapshot.rows=snapshot.rows.map(row=>{const p=prices.get(row.ticker);const at=p?.market_at?.toISOString()??null;
    if(row.eligibility==='lookup_ready'&&p?.price!=null&&priceObservationRecency(at,now.toISOString())==='recent'){row.price=Number(p.price);row.marketAt=at;}
    return analyzeListing(row,facts.get(row.ticker)??[],now);});
  snapshot.status='ok';snapshot.observedAt=(await clock()).toISOString();return snapshot;
}
export async function getNasdaqListings(){
  const r=await pool.query(`SELECT metrics->'nasdaqListings' AS snapshot FROM collection_runs ORDER BY id DESC LIMIT 1`);
  const snapshot=r.rows[0]?.snapshot as ListingSnapshot|null;
  return snapshot?.version===NASDAQ_RESEARCH_VERSION&&Array.isArray(snapshot.rows)?snapshot:null;
}
