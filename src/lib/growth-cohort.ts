import { pool } from './db';
import { priceObservationRecency } from './price-observation';
const DAY=86400000;
export type CohortPoint={ticker:string;state:string;observedAt:string;marketAt:string|null;price:number|null};
export type BenchmarkPoint={observedAt:string;marketAt:string;price:number};
export function measureGrowthCohort(points:CohortPoint[],benchmark:BenchmarkPoint[],asOf:string,horizonDays=7,followups:CohortPoint[]=[]) {
  const clock=Date.parse(asOf);
  if(!Number.isFinite(clock)||![7,30].includes(horizonDays))throw new Error('Known clock and fixed 7/30-day horizon required.');
  const valid=(p:{observedAt:string;marketAt:string|null;price:number|null})=>p.marketAt!=null
    && Number.isFinite(Date.parse(p.observedAt))&&Number.isFinite(Date.parse(p.marketAt))
    && Date.parse(p.marketAt)<=Date.parse(p.observedAt)&&Date.parse(p.observedAt)<=clock
    && p.price!=null&&Number.isFinite(p.price)&&p.price>0;
  const ordered=points.filter(p=>Number.isFinite(Date.parse(p.observedAt))&&Date.parse(p.observedAt)<=clock)
    .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const first=new Map<string,CohortPoint>();for(const p of ordered)if(!first.has(p.ticker))first.set(p.ticker,p);
  const endpoints=[...ordered,...followups.filter(valid)];
  const matching=(marketAt:string,knownBy:number)=>benchmark.filter(p=>valid(p)&&Date.parse(p.observedAt)<=knownBy
    && Math.abs(Date.parse(p.marketAt)-Date.parse(marketAt))<=20*60000)
    .sort((a,b)=>Math.abs(Date.parse(a.marketAt)-Date.parse(marketAt))-Math.abs(Date.parse(b.marketAt)-Date.parse(marketAt)))[0];
  const rows=[...first.values()].map(start=>{
    const target=Date.parse(start.observedAt)+horizonDays*DAY;
    const base={ticker:start.ticker,group:start.state,firstObservedAt:start.observedAt,firstPrice:start.price,targetAt:new Date(target).toISOString()};
    if(target>clock)return {...base,status:'not_mature',priceChangePercent:null,excessPriceChangePercent:null};
    if(!valid(start)||priceObservationRecency(start.marketAt,start.observedAt)!=='recent')return {...base,status:'baseline_unavailable',priceChangePercent:null,excessPriceChangePercent:null};
    const end=endpoints.filter(p=>p.ticker===start.ticker&&valid(p)&&Date.parse(p.marketAt!)>=target
      && Date.parse(p.marketAt!)<=target+3*DAY&&Date.parse(p.observedAt)<=target+4*DAY)
      .sort((a,b)=>Date.parse(a.marketAt!)-Date.parse(b.marketAt!)||Date.parse(a.observedAt)-Date.parse(b.observedAt))[0];
    if(!end)return {...base,status:'endpoint_unavailable',priceChangePercent:null,excessPriceChangePercent:null};
    const change=(end.price!/start.price!-1)*100;
    const bs=matching(start.marketAt!,Date.parse(start.observedAt)),be=matching(end.marketAt!,Date.parse(end.observedAt));
    return {...base,status:'price_only',endPrice:end.price,endMarketAt:end.marketAt,priceChangePercent:change,
      excessPriceChangePercent:bs&&be?change-(be.price/bs.price-1)*100:null};
  });
  const groups=[...new Set(rows.map(r=>r.group))].sort().map(group=>{
    const all=rows.filter(r=>r.group===group),measured=all.filter(r=>r.priceChangePercent!=null),paired=measured.filter(r=>r.excessPriceChangePercent!=null);
    return {group,total:all.length,measured:measured.length,paired:paired.length,missing:all.filter(r=>r.status.endsWith('unavailable')).length,
      notMature:all.filter(r=>r.status==='not_mature').length,
      meanPriceChangePercent:measured.length?measured.reduce((n,r)=>n+r.priceChangePercent!,0)/measured.length:null,
      meanExcessPriceChangePercent:paired.length?paired.reduce((n,r)=>n+r.excessPriceChangePercent!,0)/paired.length:null};
  });
  return {version:'growth-cohort-v1',asOf,horizonDays,
    limitation:'Exploratory raw USD quote changes, not trades or investment returns. Corporate actions unverified; costs excluded. Missing outcomes remain in denominators. Groups have different discovery dates and nonrandom coverage; historical comparison is not independent strategy validation.',groups,rows};
}
export async function getGrowthCohortReport(horizonDays=7) {
  const asOf=(await pool.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now.toISOString();
  const {rows}=await pool.query(`SELECT item->>'ticker' ticker,item->>'state' state,r.finished_at AS observed_at,
    item->>'marketAt' market_at,item->>'price' price FROM collection_runs r
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'growth'->'rows','[]'::jsonb)) item
    WHERE r.status='success' AND r.finished_at<=$1 AND r.metrics->'marketRadar'->'growth'->>'version'='growth-opportunities-v2'
    ORDER BY r.finished_at,r.id`,[asOf]);
  const b=await pool.query(`SELECT market_time, greatest(marked_at,market_time) observed_at,price FROM paper_strategy_marks
    WHERE ticker='SPY' AND currency='USD' AND market_time<=$1 AND marked_at<=$1
    UNION ALL SELECT p.market_at,greatest(p.captured_at,p.market_at),p.price FROM price_snapshots p JOIN companies c ON c.id=p.company_id
    WHERE c.ticker='SPY' AND p.currency='USD' AND p.market_at<=$1 AND p.captured_at<=$1`,[asOf]);
  const followups=await pool.query(`SELECT c.ticker,p.price,p.market_at,p.captured_at FROM price_snapshots p JOIN companies c ON c.id=p.company_id
    WHERE c.ticker=ANY($1::text[]) AND p.currency='USD' AND p.market_at<=$2 AND p.captured_at<=$2`,[[...new Set(rows.map(r=>r.ticker))],asOf]);
  return measureGrowthCohort(rows.map(r=>({ticker:r.ticker,state:r.state,observedAt:r.observed_at.toISOString(),marketAt:r.market_at,price:r.price==null?null:Number(r.price)})),
    b.rows.map(r=>({observedAt:r.observed_at.toISOString(),marketAt:r.market_time.toISOString(),price:Number(r.price)})),asOf,horizonDays,followups.rows.map(r=>({ticker:r.ticker,state:'followup',observedAt:r.captured_at.toISOString(),marketAt:r.market_at?.toISOString()??null,price:Number(r.price)})));
}
