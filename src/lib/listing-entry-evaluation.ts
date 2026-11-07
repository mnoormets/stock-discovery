import { pool } from './db';
import { isExpectedNewYorkRegularSession } from './price-observation';

// Frozen before the original private evaluation; this is an unfunded quote scenario.
export const LISTING_ENTRY_RULES = { version:'listing-entry-shadow-v1', registeredAt:'2026-11-06T20:43:36.660Z',
  ticketUSD:1000, feeUSD:1, slippageBps:5, entryDays:3, holdDays:7, exitGraceDays:3, quoteAgeMinutes:20 } as const;
const DAY=86400000;
export type ListingEntryObservation={ticker:string;collectionId:string;discoveredAt:string;financialPass:boolean};
export type ListingEntryQuote={id:string;ticker:string;price:number|null;currency:string|null;marketAt:string|null;capturedAt:string};
export function evaluateListingEntries(observations:ListingEntryObservation[],quotes:ListingEntryQuote[],asOf:string) {
  const clock=Date.parse(asOf);if(!Number.isFinite(clock))throw new Error('Known evaluation clock required.');
  const first=new Map<string,ListingEntryObservation>();
  for(const row of [...observations].filter(r=>Number.isFinite(Date.parse(r.discoveredAt))&&Date.parse(r.discoveredAt)<=clock)
    .sort((a,b)=>Date.parse(a.discoveredAt)-Date.parse(b.discoveredAt)))if(!first.has(row.ticker))first.set(row.ticker,row);
  const valid=quotes.filter(q=>q.currency==='USD'&&q.price!=null&&Number.isFinite(q.price)&&q.price>0&&q.marketAt!=null
    && Number.isFinite(Date.parse(q.capturedAt))&&Date.parse(q.marketAt)<=Date.parse(q.capturedAt)&&Date.parse(q.capturedAt)<=clock
    && Date.parse(q.capturedAt)-Date.parse(q.marketAt)<=LISTING_ENTRY_RULES.quoteAgeMinutes*60000&&isExpectedNewYorkRegularSession(q.marketAt))
    .sort((a,b)=>Date.parse(a.marketAt!)-Date.parse(b.marketAt!)||Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
  const rows=[...first.values()].map(start=>{
    const decision=Date.parse(start.discoveredAt);
    const base={...start,prospective:decision>Date.parse(LISTING_ENTRY_RULES.registeredAt)};
    const entry=valid.find(q=>q.ticker===start.ticker&&Date.parse(q.marketAt!)>decision&&Date.parse(q.marketAt!)<=decision+LISTING_ENTRY_RULES.entryDays*DAY)??null;
    if(!entry)return {...base,status:clock<decision+LISTING_ENTRY_RULES.entryDays*DAY?'entry_window_open':'entry_unavailable',entry:null,exit:null,quantity:null,modeledNetUSD:null};
    const target=Date.parse(entry.marketAt!)+LISTING_ENTRY_RULES.holdDays*DAY;
    const exit=valid.find(q=>q.ticker===start.ticker&&Date.parse(q.marketAt!)>=target&&Date.parse(q.marketAt!)<=target+LISTING_ENTRY_RULES.exitGraceDays*DAY)??null;
    if(!exit)return {...base,status:clock<target?'not_mature':clock<target+LISTING_ENTRY_RULES.exitGraceDays*DAY?'exit_window_open':'exit_unavailable',entry,exit:null,quantity:null,modeledNetUSD:null};
    const slippage=LISTING_ENTRY_RULES.slippageBps/10000;
    const quantity=(LISTING_ENTRY_RULES.ticketUSD-LISTING_ENTRY_RULES.feeUSD)/(entry.price!*(1+slippage));
    const endCash=quantity*exit.price!*(1-slippage)-LISTING_ENTRY_RULES.feeUSD;
    return {...base,status:'unverified_quote_scenario',entry,exit,quantity,modeledNetUSD:endCash-LISTING_ENTRY_RULES.ticketUSD};
  });
  const groups=(['retrospective','prospective'] as const).flatMap(phase=>(['all_confirmed','financial_pass'] as const).map(arm=>{
    const selected=rows.filter(r=>r.prospective===(phase==='prospective')&&(arm==='all_confirmed'||r.financialPass));
    const completed=selected.filter(r=>r.modeledNetUSD!=null);
    return {phase,arm,total:selected.length,completeScenarios:completed.length,missing:selected.filter(r=>r.status.endsWith('unavailable')).length,
      pending:selected.filter(r=>r.status==='not_mature'||r.status.endsWith('window_open')).length,
      meanModeledNetUSD:completed.length?completed.reduce((sum,r)=>sum+r.modeledNetUSD!,0)/completed.length:null};
  }));
  return {version:LISTING_ENTRY_RULES.version,asOf,rules:LISTING_ENTRY_RULES,groups,rows,
    limitation:'Unfunded quote scenarios, not orders or portfolio profit. IPO identity and corporate actions unverified; dividends, taxes and FX excluded. Missing outcomes remain in denominators; groups have nonrandom coverage.'};
}
export async function getListingEntryEvaluation() {
  const client=await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const asOf=(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now.toISOString();
    const observations=await client.query(`SELECT DISTINCT ON(item->>'ticker') item->>'ticker' ticker,r.id collection_id,r.finished_at,
      item->>'financialAssessment' financial_assessment FROM collection_runs r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'nasdaqListings'->'rows','[]'::jsonb)) item
      WHERE r.status='success' AND r.finished_at<=$1 AND r.metrics->'nasdaqListings'->>'version'='nasdaq-listing-research-v1'
        AND r.metrics->'nasdaqListings'->>'status'='ok' AND item->>'eligibility'='lookup_ready'
      ORDER BY item->>'ticker',r.finished_at,r.id`,[asOf]);
    const quotes=await client.query(`SELECT p.id,c.ticker,p.price,p.currency,p.market_at,p.captured_at
      FROM price_snapshots p JOIN companies c ON c.id=p.company_id
      WHERE c.ticker=ANY($1::text[]) AND p.captured_at<=$2 ORDER BY p.market_at,p.captured_at,p.id`,[observations.rows.map(r=>r.ticker),asOf]);
    await client.query('COMMIT');
    return evaluateListingEntries(observations.rows.map(r=>({ticker:r.ticker,collectionId:String(r.collection_id),discoveredAt:r.finished_at.toISOString(),financialPass:r.financial_assessment==='passes'})),
      quotes.rows.map(q=>({id:String(q.id),ticker:q.ticker,price:q.price==null?null:Number(q.price),currency:q.currency,marketAt:q.market_at?.toISOString()??null,capturedAt:q.captured_at.toISOString()})),asOf);
  } catch(error) { await client.query('ROLLBACK');throw error; } finally {client.release();}
}
