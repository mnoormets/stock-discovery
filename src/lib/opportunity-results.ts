export const OPPORTUNITY_RESULTS_VERSION='opportunity-results-v1';
export type OpportunityOutcome={ticker:string;sources:string[];financialPass:boolean;status:string;
  buy:unknown|null;sell:unknown|null;modeledNetUSD:number|null};
export function summarizeOpportunityResults(rows:OpportunityOutcome[]) {
  const groups:[string,OpportunityOutcome[]][]=[['All first-qualified names',rows],
    ...[...new Set(rows.flatMap(r=>r.sources))].sort().map(s=>[s,rows.filter(r=>r.sources.includes(s))] as [string,OpportunityOutcome[]]),
    ['Financial checks passed',rows.filter(r=>r.financialPass)],
    ['Financial checks not passed or unknown',rows.filter(r=>!r.financialPass)]];
  return {version:OPPORTUNITY_RESULTS_VERSION,groups:groups.map(([name,items])=>{
    const closed=items.filter(r=>r.buy!=null&&r.sell!=null&&r.modeledNetUSD!=null&&Number.isFinite(r.modeledNetUSD));
    const values=closed.map(r=>r.modeledNetUSD!);
    const missingExit=items.filter(r=>r.buy!=null&&(r.status==='exit_unavailable'||(r.sell!=null&&!closed.includes(r)))).length;
    const wins=values.filter(v=>v>0).length,losses=values.filter(v=>v<0).length;
    return {name,candidates:items.length,entries:items.filter(r=>r.buy!=null).length,closed:closed.length,
      awaitingEntry:items.filter(r=>r.buy==null&&r.status!=='entry_unavailable').length,
      missingEntry:items.filter(r=>r.buy==null&&r.status==='entry_unavailable').length,
      open:items.filter(r=>r.buy!=null&&r.sell==null&&r.status!=='exit_unavailable').length,missingExit,
      wins,losses,flat:values.length-wins-losses,winRate:values.length?wins/values.length*100:null,
      closedNetUSD:values.length?values.reduce((a,b)=>a+b,0):null,
      bestNetUSD:values.length?Math.max(...values):null,worstNetUSD:values.length?Math.min(...values):null};
  })};
}
export const OPPORTUNITY_SOURCE_LABELS:Record<string,string>={financial_growth:'Revenue and cash-flow growth',
 price_momentum:'Positive price trends',new_listing:'New exchange listings',financial_filing:'Recent financial filings',
 multiple_publisher_mentions:'Multiple news publishers'};
