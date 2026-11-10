import { selectGrowthEvidence } from './growth-opportunities';
import type { FinancialPoint } from './company-financials';
import type { FilingNotice, IssuerIdentity } from './discovery-evidence';
import { evidenceHash, referenceWindow, type ResearchProtocol } from './strategy-protocols';
export type KnownFact = FinancialPoint & {knownAt:string};
export interface ResearchMember {
 key:string; ticker:string; name:string; cik:string|null; companyId:string|null;
 inInventory:boolean; discoverySources:string[]; discoveredAt:string; identityKnownAt:string|null;
 storedCIK:string|null; quoteType:string|null; currency:string|null; exchange:string|null;
 marketCapUSD:number|null; marketCapKnownAt:string|null; marketCapMarketAt:string|null;
 facts:KnownFact[]; availableFactCount:number;
}
export interface ResearchInputs {
 collectionId:number; collectionStartedAt:string; frozenAt:string; inventoryObservedAt:string;
 inventoryStatus:'complete_inventory'|'partial_inventory'; inventoryCount:number; members:ResearchMember[]; filings:FilingNotice[]; priorEventKeys?:string[];
}
export interface ResearchSignal {
 key:string; ticker:string; permanentIssuerId:string|null; securityId:null; companyId:string|null;
 discoveredAt:string; referenceAt:string; eligibleAt:string|null; signalAt:string|null; earliestExecutableAt:string|null;
 eligibility:'eligible'|'ineligible'; reasons:string[]; rank:number|null;
 uiStatus:'eligible_visible'|'eligible_ui_cap_excluded'|'ineligible'; corporateActionStatus:'unverified';
 outcomeStatus:'pending'; marketCapUSD:number|null; capGroup:string; benchmark:string|null;
 missingComponents:string[]; components:{revenueGrowth:number|null;operatingCashFlow:number|null;basicSharesGrowth:number|null;event:FilingNotice|null};
 featureKnowledgeTimestamps:string[]; sources:string[];
}
const DAY=86400000;
export function knownShares(points:KnownFact[],at:string):KnownFact[] {
 const now=Date.parse(at),rows=points.filter(p=>p.metric==='shares_outstanding'&&p.unit==='shares'&&p.periodKind==='instant'
   &&Number.isFinite(p.value)&&Date.parse(p.filedAt)<=now&&Date.parse(p.periodEnd)<=now&&Date.parse(p.knownAt)<=now)
   .sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.filedAt.localeCompare(a.filedAt)||(b.id??0)-(a.id??0));
 const latest=rows[0];if(!latest||now-Date.parse(latest.periodEnd)>365*DAY)return [];
 const prior=rows.filter(p=>p.periodEnd<latest.periodEnd&&p.taxonomy===latest.taxonomy&&p.tag===latest.tag
   &&Math.abs((Date.parse(latest.periodEnd)-Date.parse(p.periodEnd))/DAY-365)<=35)
   .sort((a,b)=>Math.abs((Date.parse(latest.periodEnd)-Date.parse(a.periodEnd))/DAY-365)
    -Math.abs((Date.parse(latest.periodEnd)-Date.parse(b.periodEnd))/DAY-365)||b.filedAt.localeCompare(a.filedAt))[0];
 return prior?[latest,prior]:[latest];
}
export function evaluateResearchProtocol(input:ResearchInputs,protocol:ResearchProtocol):ResearchSignal[] {
 const now=Date.parse(input.frozenAt),window=referenceWindow(input.frozenAt),fundamental=protocol.id==='fundamental_growth_v1';
 const rows=input.members.map((m):ResearchSignal=>{
   const reasons:string[]=[],missing:string[]=[];
   const identity=m.cik&&m.storedCIK===m.cik&&m.identityKnownAt&&Date.parse(m.identityKnownAt)<=now;
   if(!identity)reasons.push('issuer_identity_unknown_or_conflicting');
   if(!m.inInventory)reasons.push('not_in_current_inventory');
   if(m.quoteType!=='EQUITY'||m.currency!=='USD'||!['NMS','NGM','NCM','NYQ','ASE','NASDAQ','NYSE','NYSE American','Nasdaq'].includes(m.exchange??'')
     ||/\b(warrants?|rights|units)\b|\bpreferred (stock|shares)\b|\bETF\b|\bfund\b/i.test(m.name))reasons.push('common_equity_classification_unverified_or_excluded');
   if(!window)reasons.push('calendar_unavailable');
   const facts=m.facts.filter(f=>Date.parse(f.knownAt)<=now&&Date.parse(f.filedAt)<=now);
   const growth=selectGrowthEvidence(facts,new Date(input.frozenAt));
   const shares=knownShares(facts,input.frozenAt);
   const revenueGrowth=growth.length===3&&growth[0].value>0&&growth[1].value>0?(growth[0].value/growth[1].value-1)*100:null;
   const cash=growth[2]?.value??null;
   const dilution=shares.length===2&&shares[1].value>0&&shares[0].value>0?(shares[0].value/shares[1].value-1)*100:null;
   const event=input.filings.filter(f=>f.cik===m.cik&&f.tickers.includes(m.ticker)&&['10-Q','10-K','20-F','40-F'].includes(f.form)
     &&Date.parse(f.observedAt)>=Date.parse(input.collectionStartedAt)&&Date.parse(f.observedAt)<=now
     &&Number.isFinite(Date.parse(f.filedAt))&&Date.parse(f.filedAt)<=now
     &&/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\//.test(f.url)
     &&Number(f.url.match(/\/data\/(\d+)\//)?.[1])===Number(m.cik)
     &&!(input.priorEventKeys??[]).includes(f.cik+'|'+f.form+'|'+f.filedAt))
     .sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||a.url.localeCompare(b.url))[0]??null;
   if(fundamental){
     if(revenueGrowth==null){missing.push('coherent_revenue_growth');reasons.push('coherent_revenue_growth_unavailable');}
     else if(revenueGrowth<25)reasons.push('revenue_growth_below_25');
     if(cash==null){missing.push('same_period_ocf');reasons.push('same_period_ocf_unavailable');}
     else if(cash<=0)reasons.push('operating_cash_flow_not_positive');
     if(dilution==null){missing.push('comparable_basic_shares');reasons.push('basic_shares_growth_unavailable');}
     else if(dilution>5)reasons.push('basic_shares_growth_above_5');
   }else if(!event){missing.push('new_confirmed_primary_event');reasons.push('new_confirmed_primary_event_unavailable');}
   const cap=m.marketCapUSD!=null&&Number.isFinite(m.marketCapUSD)&&m.marketCapUSD>0?m.marketCapUSD:null;
   const capGroup=cap==null?'unknown':cap<2e9?'small':cap<1e10?'mid':'large';
   const benchmark=cap==null?null:cap<2e9?protocol.benchmarkAssignmentRule.small:protocol.benchmarkAssignmentRule.larger;
   if(!benchmark)missing.push('benchmark_assignment');
   const eligible=reasons.length===0;
   return {key:m.key,ticker:m.ticker,permanentIssuerId:m.cik?'sec-cik:'+m.cik:null,securityId:null,companyId:m.companyId,
     discoveredAt:m.discoveredAt,referenceAt:input.frozenAt,eligibleAt:eligible?input.frozenAt:null,signalAt:eligible?input.frozenAt:null,
     earliestExecutableAt:eligible?window!.earliest:null,eligibility:eligible?'eligible':'ineligible',reasons,rank:null,
     uiStatus:eligible?'eligible_visible':'ineligible',corporateActionStatus:'unverified',outcomeStatus:'pending',
     marketCapUSD:cap,capGroup,benchmark,missingComponents:missing,
     components:{revenueGrowth,operatingCashFlow:cash,basicSharesGrowth:dilution,event},
     featureKnowledgeTimestamps:[m.identityKnownAt,m.marketCapKnownAt,...facts.map(f=>f.knownAt),event?.observedAt].filter(Boolean) as string[],
     sources:[...m.discoverySources,...facts.map(f=>f.sourceUrl),...(event?[event.url]:[])]};
 });
 const ranked=rows.filter(r=>r.eligibility==='eligible').sort((a,b)=>(fundamental?b.components.revenueGrowth!-a.components.revenueGrowth!
   :b.components.event!.observedAt.localeCompare(a.components.event!.observedAt))||a.ticker.localeCompare(b.ticker)||a.key.localeCompare(b.key));
 ranked.forEach((r,i)=>{r.rank=i+1;r.uiStatus=i<protocol.uiCap?'eligible_visible':'eligible_ui_cap_excluded';});
 return rows.sort((a,b)=>a.key.localeCompare(b.key));
}
export function replaySnapshot(inputs:ResearchInputs,protocol:ResearchProtocol,rows:ResearchSignal[]) {
 return evidenceHash(evaluateResearchProtocol(inputs,protocol))===evidenceHash(rows);
}
export function inventoryMembers(inventory:IssuerIdentity[]) {
 return new Map(inventory.map(r=>[r.ticker+'|'+r.cik,r]));
}
