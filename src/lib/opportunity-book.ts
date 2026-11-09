import type { PoolClient } from 'pg';
import { pool } from './db';
import { isExpectedNewYorkRegularSession, priceObservationRecency } from './price-observation';
import type { DiscoveryEvidence } from './discovery-evidence';
import type { MarketRadarSnapshot } from './market-radar';
import type { ListingSnapshot } from './nasdaq-listings';
export const OPPORTUNITY_VERSION='unified-opportunity-v1';
export const OPPORTUNITY_PAPER_RULES={version:'unfunded-opportunity-paper-v1',ticketUSD:1000,feeUSD:1,slippageBps:5,entryDays:3,holdDays:7,exitGraceDays:3,quoteAgeMinutes:20} as const;
const DAY=86400000;
export interface OpportunityRow {ticker:string;name:string;state:'qualified_research'|'price_unavailable';sources:string[];urls:string[];price:number|null;marketAt:string|null;financialPass:boolean;}
export interface OpportunitySnapshot {version:typeof OPPORTUNITY_VERSION;evaluatedAt:string;rows:OpportunityRow[];}
export function buildUnifiedOpportunities(evidence:DiscoveryEvidence,radar:MarketRadarSnapshot,listings:ListingSnapshot,now:Date):OpportunitySnapshot {
  const rows=new Map<string,OpportunityRow>();
  function add(ticker:string,source:string,urls:string[]=[]) {
    const stock=radar.stocks.find(s=>s.ticker===ticker),listing=listings.rows.find(r=>r.ticker===ticker&&r.eligibility==='lookup_ready');
    const price=stock?.price??listing?.price??null,marketAt=stock?.marketAt??listing?.marketAt??null;
    const growth=radar.growth?.rows.find(r=>r.ticker===ticker);
    const financialPass=listing?.financialAssessment==='passes'||!!(growth&&growth.revenueGrowth!=null&&growth.revenueGrowth>=25&&growth.facts[2]?.value>0);
    const old=rows.get(ticker);rows.set(ticker,{ticker,name:stock?.name??listing?.name??ticker,
      state:price!=null&&price>0&&priceObservationRecency(marketAt,now.toISOString())==='recent'?'qualified_research':'price_unavailable',
      sources:[...new Set([...(old?.sources??[]),source])],urls:[...new Set([...(old?.urls??[]),...urls])].slice(0,5),price,marketAt,financialPass});
  }
  for(const r of radar.growth?.rows??[])if(['early','momentum'].includes(r.state))add(r.ticker,'financial_growth');
  for(const r of radar.growth?.priceMomentum?.rows??[])if(r.state==='observe')add(r.ticker,'price_momentum');
  for(const r of listings.rows)if(r.eligibility==='lookup_ready')add(r.ticker,'new_listing');
  for(const f of evidence.filings)for(const t of f.tickers)if(!evidence.identityConflicts.includes(t))add(t,'financial_filing',[f.url]);
  // A mention is an unvalidated research lead, never a recommendation or forecast.
  const webTickers=[...new Set(evidence.web.flatMap(w=>w.tickers))];
  for(const t of webTickers){const items=evidence.web.filter(w=>w.publishedAt!=null&&w.tickers.includes(t));
    if(!evidence.identityConflicts.includes(t)&&new Set(items.map(w=>w.publisher)).size>=2)add(t,'multiple_publisher_mentions',items.map(w=>w.url));}
  return {version:OPPORTUNITY_VERSION,evaluatedAt:now.toISOString(),rows:[...rows.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker))};
}
type DB=Pick<PoolClient,'query'>;
type Intent={ticker:string;collection_id:string;discovered_at:Date;item:OpportunityRow};
type Event={id:string;ticker:string;side:'buy'|'sell';market_at:Date;recorded_at:Date;quantity:string;fill_price:string;gross_usd:string;fee_usd:string;quote_snapshot_id:string};
async function intents(db:DB,now:Date):Promise<Intent[]> {
  return (await db.query(`SELECT DISTINCT ON(x->>'ticker') x->>'ticker' ticker,r.id collection_id,r.finished_at discovered_at,x item
    FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'opportunities'->'rows','[]'::jsonb)) x
    WHERE r.status='success' AND r.finished_at<=$1 AND r.metrics->'opportunities'->>'version'=$2
      AND x->>'state'='qualified_research'
      AND CASE WHEN pg_input_is_valid(r.metrics->'opportunities'->>'evaluatedAt','timestamptz') THEN (r.metrics->'opportunities'->>'evaluatedAt')::timestamptz<=r.finished_at ELSE false END
    ORDER BY x->>'ticker',r.finished_at,r.id`,[now.toISOString(),OPPORTUNITY_VERSION])).rows;
}
async function available(db:DB){return (await db.query("SELECT to_regclass('public.unified_opportunity_paper') IS NOT NULL ok")).rows[0].ok===true;}
function windowState(start:Intent,buy:Event|undefined,sell:Event|undefined,now:Date) {
  if(sell)return 'complete_unverified';
  if(!buy)return now.getTime()<=start.discovered_at.getTime()+OPPORTUNITY_PAPER_RULES.entryDays*DAY?'entry_window_open':'entry_unavailable';
  const target=buy.market_at.getTime()+OPPORTUNITY_PAPER_RULES.holdDays*DAY;
  return now.getTime()<target?'not_mature':now.getTime()<=target+OPPORTUNITY_PAPER_RULES.exitGraceDays*DAY?'exit_window_open':'exit_unavailable';
}
export async function getOpportunityBook(now?:Date) {
  const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const clock=now??(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
    const first=await intents(client,clock),ready=await available(client);
    const events:Event[]=ready?(await client.query('SELECT * FROM unified_opportunity_paper WHERE policy_version=$1 AND recorded_at<=$2 ORDER BY id',[OPPORTUNITY_PAPER_RULES.version,clock.toISOString()])).rows:[];
    const capital=(await client.query(`SELECT a.status,a.initial_usd+COALESCE(sum(CASE WHEN t.side='buy' THEN -t.gross_usd-t.fee_usd ELSE t.gross_usd-t.fee_usd END),0) cash_usd
      FROM paper_capital_accounts a LEFT JOIN paper_capital_trades t ON t.policy_version=a.policy_version AND t.book_key='strategy' WHERE a.policy_version='early-capital-v1' GROUP BY a.policy_version`)).rows[0]??null;
    const rows=first.map(start=>{const buy=events.find(e=>e.ticker===start.ticker&&e.side==='buy'),sell=events.find(e=>e.ticker===start.ticker&&e.side==='sell');
      return {...start.item,collectionId:String(start.collection_id),firstQualifiedAt:start.discovered_at.toISOString(),status:windowState(start,buy,sell,clock),buy:buy??null,sell:sell??null,
        modeledNetUSD:buy&&sell?Number(sell.gross_usd)-Number(sell.fee_usd)-Number(buy.gross_usd)-Number(buy.fee_usd):null,
        capitalDecision:capital?.status==='risk_stopped'?'blocked_by_capital_risk_stop':'not_activated_for_capital'};});
    await client.query('COMMIT');return {version:OPPORTUNITY_PAPER_RULES.version,asOf:clock.toISOString(),rules:OPPORTUNITY_PAPER_RULES,available:ready,capital,rows};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
/** Appends unfunded live quote observations only; never calls a capital/control executor. */
export async function recordOpportunityPaper(now?:Date) {
  const client=await pool.connect();try{const clock=now??(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
    if(!isExpectedNewYorkRegularSession(clock))return {inserted:0,skipped:'outside regular session'};
    if(!await available(client))return {inserted:0,skipped:'migration required'};
    await client.query('BEGIN');const locked=(await client.query("SELECT pg_try_advisory_xact_lock(hashtext('stock-discovery:unfunded-opportunity-paper')) ok")).rows[0].ok;
    if(!locked){await client.query('ROLLBACK');return {inserted:0,skipped:'lock busy'};}
    const first=await intents(client,clock);const events:Event[]=(await client.query('SELECT * FROM unified_opportunity_paper WHERE policy_version=$1 ORDER BY id',[OPPORTUNITY_PAPER_RULES.version])).rows;
    const quotes=(await client.query(`SELECT p.id,c.ticker,p.price,p.currency,p.market_at,p.captured_at FROM price_snapshots p JOIN companies c ON c.id=p.company_id
      WHERE c.ticker=ANY($1::text[]) AND p.currency='USD' AND p.price>0 AND p.market_at<=p.captured_at AND p.captured_at<=$2
        AND p.market_at >= $2::timestamptz-interval '20 minutes' ORDER BY p.market_at,p.captured_at,p.id`,[first.map(r=>r.ticker),clock.toISOString()])).rows;
    let inserted=0;for(const start of first){if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(start.ticker))continue;
      const buy=events.find(e=>e.ticker===start.ticker&&e.side==='buy'),sell=events.find(e=>e.ticker===start.ticker&&e.side==='sell'),state=windowState(start,buy,sell,clock);
      if(!['entry_window_open','exit_window_open'].includes(state))continue;
      const target=buy?buy.market_at.getTime()+OPPORTUNITY_PAPER_RULES.holdDays*DAY:start.discovered_at.getTime();
      const q=quotes.find(q=>q.ticker===start.ticker&&isExpectedNewYorkRegularSession(q.market_at)&&Number.isFinite(Number(q.price))
        &&(buy?q.market_at.getTime()>=target:q.market_at.getTime()>target));if(!q)continue;
      const side=buy?'sell':'buy',fillPrice=Number(q.price)*(1+(buy?-1:1)*OPPORTUNITY_PAPER_RULES.slippageBps/10000);
      const quantity=buy?Number(buy.quantity):(OPPORTUNITY_PAPER_RULES.ticketUSD-OPPORTUNITY_PAPER_RULES.feeUSD)/fillPrice;
      const result=await client.query(`INSERT INTO unified_opportunity_paper(policy_version,ticker,side,collection_run_id,quote_snapshot_id,buy_event_id,market_at,recorded_at,quantity,fill_price,gross_usd,fee_usd,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
        [OPPORTUNITY_PAPER_RULES.version,start.ticker,side,start.collection_id,q.id,buy?.id??null,q.market_at,clock.toISOString(),quantity,fillPrice,quantity*fillPrice,OPPORTUNITY_PAPER_RULES.feeUSD,
          JSON.stringify({opportunity:start.item,firstQualifiedAt:start.discovered_at.toISOString(),rules:OPPORTUNITY_PAPER_RULES,corporateActions:'unverified',scope:'unfunded_quote_scenario'})]);
      inserted+=result.rowCount??0;
    }await client.query('COMMIT');return {inserted};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function getOpportunityQuoteNeeds(now:Date) {
  const book=await getOpportunityBook(now);return new Set(book.available?book.rows.filter(r=>['entry_window_open','exit_window_open'].includes(r.status)).map(r=>r.ticker):[]);
}
