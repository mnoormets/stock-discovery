import { pool } from './db';
import { financialEnrichmentQueue } from './company-financials';
import type { DiscoveryEvidence } from './discovery-evidence';

/** Current backlog from frozen filing observations; never imports facts or spends a request. */
export async function getFilingRefreshBacklog(scan: DiscoveryEvidence) {
  const now=(await pool.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
  const notices=new Map<string,string>();
  for(const f of scan.filings) {
    if(!['10-Q','10-K','20-F','40-F'].includes(f.form)||!/^\d{1,10}$/.test(f.cik)
      ||!Number.isFinite(Date.parse(f.filedAt))||!Number.isFinite(Date.parse(f.observedAt))
      ||Date.parse(f.filedAt)>now.getTime()||Date.parse(f.observedAt)>now.getTime())continue;
    const cik=f.cik.replace(/^0+/,'');if(f.filedAt>(notices.get(cik)??''))notices.set(cik,f.filedAt);
  }
  const budget=(await pool.query(`SELECT count(*)::int used,
    count(*) FILTER(WHERE status='success')::int successful,
    count(*) FILTER(WHERE status='unavailable')::int unavailable,
    count(*) FILTER(WHERE status='error')::int failed
    FROM financial_enrichment_status WHERE last_attempt_at >=
    (date_trunc('day',$1::timestamptz AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'Europe/Tallinn')
    AND last_attempt_at <= $1`,[now.toISOString()])).rows[0];
  const remaining=Math.max(0,20-budget.used);
  const queue=await financialEnrichmentQueue(100000);
  const ranks=new Map(queue.map((r,i)=>[r.ticker,i+1]));
  const stored=notices.size?(await pool.query(`SELECT c.ticker,ltrim(c.sec_cik,'0') cik,max(f.filed_at)::text filed_at,
    e.status,e.last_attempt_at FROM companies c LEFT JOIN financial_facts f ON f.company_id=c.id
    LEFT JOIN financial_enrichment_status e ON e.company_id=c.id
    WHERE ltrim(c.sec_cik,'0')=ANY($1::text[]) GROUP BY c.id,e.status,e.last_attempt_at`,[[...notices.keys()]])).rows:[];
  const rows=stored.flatMap(r=>{
    const latest=notices.get(r.cik)!;if(r.filed_at&&latest<=r.filed_at)return [];
    const rank=ranks.get(r.ticker)??null;
    const cooldown=r.last_attempt_at&&new Date(r.last_attempt_at).getTime()>=now.getTime()-86400000;
    const reason=rank!=null?(remaining===0?'Daily refresh allowance used':rank<=remaining?'Within remaining refresh allowance':'Waiting behind earlier eligible companies')
      :cooldown?'Waiting for the existing retry interval':'Not currently eligible; check identity, instrument and recent-price coverage';
    return [{ticker:String(r.ticker),latest,stored:r.filed_at as string|null,eligibleRank:rank,
      lastAttemptAt:r.last_attempt_at?.toISOString()??null,lastStatus:r.status as string|null,reason}];
  }).sort((a,b)=>(a.eligibleRank??Infinity)-(b.eligibleRank??Infinity)||a.ticker.localeCompare(b.ticker));
  return {asOf:now.toISOString(),dailyLimit:20,...budget,remaining,eligibleQueue:queue.length,rows};
}
