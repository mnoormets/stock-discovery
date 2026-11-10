import { pool } from './db';
import { evidenceHash, protocolHash, engineManifest, referenceWindow, tradingSession, addTradingSessions, type ResearchProtocol } from './strategy-protocols';
import { replaySnapshot, type ResearchInputs, type ResearchSignal } from './strategy-signal-evaluation';
import { researchSchemaAvailable } from './strategy-snapshots';
import { isExpectedNewYorkRegularSession, newYorkPriceDate } from './price-observation';

export interface ResearchQuote {id:string;companyId:string;ticker:string;price:number;currency:string;source:string;marketAt:string;capturedAt:string;}
type Identity={companyId:string;ticker:string;cik:string|null};
function validQuote(q:ResearchQuote,asOf:string) {
 const at=Date.parse(q.marketAt),known=Date.parse(q.capturedAt);
 return Number.isFinite(q.price)&&q.price>0&&q.currency==='USD'&&/yahoo/i.test(q.source)
   &&Number.isFinite(at)&&known>=at&&known-at<=20*60000&&known<=Date.parse(asOf)&&isExpectedNewYorkRegularSession(q.marketAt);
}
function paired(quotes:ResearchQuote[],ticker:string,stock:ResearchQuote|undefined) {
 return stock?quotes.filter(q=>q.ticker===ticker&&newYorkPriceDate(q.marketAt)===newYorkPriceDate(stock.marketAt)
   &&Math.abs(Date.parse(q.marketAt)-Date.parse(stock.marketAt))<=300000)
   .sort((a,b)=>Math.abs(Date.parse(a.marketAt)-Date.parse(stock.marketAt))-Math.abs(Date.parse(b.marketAt)-Date.parse(stock.marketAt))||a.id.localeCompare(b.id))[0]:undefined;
}
function netReturn(entry:number,exit:number,p:ResearchProtocol) {
 const c=p.costAssumptions,shares=(c.notionalUSD-c.feeUSDPerSide)/(entry*(1+c.slippageBpsPerSide/10000));
 return (shares*exit*(1-c.slippageBpsPerSide/10000)-c.feeUSDPerSide-c.notionalUSD)/c.notionalUSD*100;
}
export function auditResearchSignals(rows:ResearchSignal[],protocol:ResearchProtocol,quotes:ResearchQuote[],identities:Identity[],asOf:string) {
 const usable=quotes.filter(q=>validQuote(q,asOf)).sort((a,b)=>a.marketAt.localeCompare(b.marketAt)||a.capturedAt.localeCompare(b.capturedAt)||a.id.localeCompare(b.id));
 const byCompany=new Map<string,ResearchQuote[]>();for(const q of usable)byCompany.set(q.companyId,[...(byCompany.get(q.companyId)??[]),q]);
 const identityMap=new Map(identities.map(i=>[i.companyId,i]));
 const result=rows.map(row=>{
   const window=referenceWindow(row.referenceAt),identity=row.companyId?identityMap.get(row.companyId):null;
   const identityOK=!!identity&&identity.ticker===row.ticker&&row.permanentIssuerId==='sec-cik:'+identity.cik;
   const candidates=identityOK?(byCompany.get(row.companyId!)??[]):[];
   const entry=window?candidates.find(q=>q.marketAt>=window.earliest&&q.marketAt<window.deadline):undefined;
   const entryReason=!identityOK?'frozen_security_identity_unavailable_or_changed':!window?'calendar_unavailable':entry?null
     :asOf<window.deadline?'entry_window_open':'entry_price_unavailable';
   const entryStatus=entry?'observed':identityOK&&window&&asOf<window.deadline?'pending':'unavailable';
   const benchmarkEntry=row.benchmark?paired(usable,row.benchmark,entry):undefined;
   const outcomes=protocol.horizonsTradingDays.map(horizon=>{
     const entryDay=entry?newYorkPriceDate(entry.marketAt):window?newYorkPriceDate(new Date(Date.parse(window.deadline)-1).toISOString()):null;
     const targetDay=entryDay?addTradingSessions(entryDay,horizon):null,session=targetDay?tradingSession(targetDay):null;
     const due=!!session&&asOf>=session.close;
     const exit=entry&&session?candidates.find(q=>q.marketAt>=session.open&&q.marketAt<session.close):undefined;
     const benchmarkExit=row.benchmark?paired(usable,row.benchmark,exit):undefined;
     const rawPaired=!!entry&&!!exit&&!!benchmarkEntry&&!!benchmarkExit;
     const reasons:string[]=[];
     if(!entry)reasons.push(entryReason!);
     else if(!session)reasons.push('calendar_unavailable');
     else if(!exit)reasons.push(due?'target_session_price_unavailable':'horizon_pending');
     if(!row.benchmark)reasons.push('benchmark_assignment_unavailable');
     else {if(entry&&!benchmarkEntry)reasons.push('benchmark_entry_unavailable');if(exit&&!benchmarkExit)reasons.push('benchmark_exit_unavailable');}
     const status=rawPaired?'observed_unverified':!entry?entryStatus==='pending'?'pending':'unavailable'
       :!session?'unavailable':due?'unavailable':'pending';
     return {horizonTradingDays:horizon,targetDay,due,status,reasons,stockObserved:!!exit,rawPaired,verifiedComparable:false,
       corporateActionStatus:row.corporateActionStatus,
       rawReturnPercent:entry&&exit?(exit.price/entry.price-1)*100:null,
       unverifiedModeledNetExcessPercent:rawPaired?netReturn(entry!.price,exit!.price,protocol)-netReturn(benchmarkEntry!.price,benchmarkExit!.price,protocol):null,
       exit:exit??null,benchmarkExit:benchmarkExit??null};
   });
   return {key:row.key,ticker:row.ticker,permanentIssuerId:row.permanentIssuerId,eligibility:row.eligibility,uiStatus:row.uiStatus,
     observationRole:row.eligibility==='eligible'?'signal':'excluded_control',rank:row.rank,capGroup:row.capGroup,benchmark:row.benchmark,
     missingComponents:row.missingComponents,reasons:row.reasons,entryStatus,entryReason,entry:entry??null,benchmarkEntry:benchmarkEntry??null,outcomes};
 });
 function group(key:string,groupRows:typeof result) {
   const outcomes=protocol.horizonsTradingDays.map(h=>{
     const items=groupRows.map(r=>r.outcomes.find(o=>o.horizonTradingDays===h)!);
     const due=items.filter(o=>o.due),pairedCount=items.filter(o=>o.rawPaired).length;
     return {horizonTradingDays:h,rows:items.length,due:due.length,pending:items.filter(o=>o.status==='pending').length,
       unavailable:items.filter(o=>o.status==='unavailable').length,stockObserved:items.filter(o=>o.stockObserved).length,
       rawPaired:pairedCount,verifiedComparable:0,allRowsRawCoveragePercent:items.length?pairedCount/items.length*100:null,
       dueRawCoveragePercent:due.length?due.filter(o=>o.rawPaired).length/due.length*100:null};
   });
   return {key,rows:groupRows.length,eligible:groupRows.filter(r=>r.eligibility==='eligible').length,
     ineligible:groupRows.filter(r=>r.eligibility==='ineligible').length,uiCapExcluded:groupRows.filter(r=>r.uiStatus==='eligible_ui_cap_excluded').length,
     entryObserved:groupRows.filter(r=>r.entryStatus==='observed').length,entryUnavailable:groupRows.filter(r=>r.entryStatus==='unavailable').length,outcomes};
 }
 const groups=[group('all',result)];
 for(const kind of ['eligibility','capGroup','rank'] as const){
   const key=(r:typeof result[number])=>kind==='rank'?(r.rank==null?'unranked':r.rank<=2?'1-2':r.rank<=5?'3-5':r.rank<=10?'6-10':'11+'):r[kind];
   for(const label of [...new Set(result.map(key))].sort())groups.push(group(kind+':'+label,result.filter(r=>key(r)===label)));
 }
 const missingReasons:Record<string,number>={};for(const r of result)for(const reason of [...new Set([...r.reasons,...r.missingComponents,...(r.entryReason?[r.entryReason]:[])])])
   missingReasons[reason]=(missingReasons[reason]??0)+1;
 const stages:[string,(r:typeof result[number])=>boolean][]=[
   ['retained_universe',()=>true],['current_inventory',r=>!r.reasons.includes('not_in_current_inventory')],
   ['issuer_verified',r=>!r.reasons.includes('issuer_identity_unknown_or_conflicting')],
   ['common_equity_verified',r=>!r.reasons.includes('common_equity_classification_unverified_or_excluded')],
   ['required_features_known',r=>!r.missingComponents.some(k=>k!=='benchmark_assignment')],
   ['eligible',r=>r.eligibility==='eligible'],['benchmark_assigned',r=>r.benchmark!=null],['entry_observed',r=>r.entryStatus==='observed']];
 let remaining=result;const funnel=stages.map(([stage,accept])=>{remaining=remaining.filter(accept);return{stage,rows:remaining.length,percentOfUniverse:result.length?remaining.length/result.length*100:null};});
 return {strategyId:protocol.id,definition:protocol,groups,funnel,missingReasons,rows:result};
}
export async function getStrategyCoverage(collectionId?:number,asOf?:string) {
 if(!await researchSchemaAvailable())return {available:false as const,report:null};
 const client=await pool.connect();
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const clock=(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
   if(asOf&&!Number.isFinite(Date.parse(asOf)))throw Error('Invalid audit as-of');
   const at=asOf?new Date(asOf).toISOString():clock.toISOString();if(Date.parse(at)>clock.getTime())throw Error('Audit as-of must be a valid observed past time');
   const universe=(await client.query(`SELECT u.* FROM research_universes u JOIN collection_runs c ON c.id=u.collection_run_id WHERE c.status='success'
     AND ($1::bigint IS NULL OR u.collection_run_id=$1) ORDER BY u.frozen_at LIMIT 1`,[collectionId??null])).rows[0];
   if(!universe){await client.query('COMMIT');return {available:true as const,report:null};}
   const inputs=universe.inputs as ResearchInputs;if(at<inputs.frozenAt)throw Error('Audit precedes frozen evidence');
   if(evidenceHash(inputs)!==universe.source_hash)throw Error('Frozen universe hash mismatch');
   const snapshots=(await client.query(`SELECT s.*,p.definition,p.engine_manifest FROM research_strategy_snapshots s
     JOIN research_protocols p USING(strategy_id,version,version_hash) WHERE collection_run_id=$1 ORDER BY strategy_id`,[universe.collection_run_id])).rows;
   const symbols=[...new Set(snapshots.flatMap(s=>(s.rows as ResearchSignal[]).flatMap(r=>r.benchmark?[r.benchmark]:[])))];
   const prices=(await client.query(`SELECT p.*,c.ticker FROM price_snapshots p JOIN companies c ON c.id=p.company_id
     WHERE p.market_at>$1 AND p.captured_at<=$2 AND (p.company_id=ANY($3::bigint[]) OR c.ticker=ANY($4::text[]))
     ORDER BY p.market_at,p.captured_at,p.id`,[inputs.frozenAt,at,inputs.members.map(m=>m.companyId).filter(Boolean),symbols])).rows;
   const quotes:ResearchQuote[]=prices.map(p=>({id:String(p.id),companyId:String(p.company_id),ticker:p.ticker,price:Number(p.price),currency:p.currency,source:p.source,
     marketAt:p.market_at.toISOString(),capturedAt:p.captured_at.toISOString()}));
   const identities=(await client.query('SELECT id,ticker,sec_cik FROM companies WHERE id=ANY($1::bigint[])',[inputs.members.map(m=>m.companyId).filter(Boolean)])).rows
     .map(c=>({companyId:String(c.id),ticker:c.ticker,cik:/^\d{1,10}$/.test(c.sec_cik??'')?String(c.sec_cik).padStart(10,'0'):null}));
   const currentManifest=engineManifest();
   const strategies=snapshots.map(s=>{
     if(evidenceHash(s.rows)!==s.snapshot_hash)throw Error('Frozen signal hash mismatch');
     const sameEngine=evidenceHash(s.engine_manifest)===evidenceHash(currentManifest);
     const integrity=protocolHash(s.definition,s.engine_manifest)===s.version_hash;
     return {...auditResearchSignals(s.rows,s.definition,quotes,identities,at),version:s.version,versionHash:s.version_hash,snapshotHash:s.snapshot_hash,
       definitionIntegrity:integrity,reproducible:sameEngine&&integrity&&replaySnapshot(inputs,s.definition,s.rows),engineMatches:sameEngine};
   });
   const report={version:'strategy-outcome-coverage-v1',asOf:at,collectionId:Number(universe.collection_run_id),frozenAt:inputs.frozenAt,sourceHash:universe.source_hash,
     inventoryStatus:inputs.inventoryStatus,inventoryCount:inputs.inventoryCount,membershipRecords:inputs.members.length,
     uniqueTickers:new Set(inputs.members.map(m=>m.ticker)).size,uniqueKnownIssuers:new Set(inputs.members.map(m=>m.cik).filter(Boolean)).size,
     scope:'Frozen inventory plus stored/observed names; not proof of complete common-stock classification or full-market financial coverage',
     edgeAssessment:'not_evaluated_coverage_only',strategies,
     limitations:['Corporate actions/share-class identity unverified: verified comparable outcomes stay zero.','Fixed costs are unvalidated; no funded portfolio, trades or goal profit.',
       'All excluded/unknown names remain controls. Missing target/benchmark prices remain unavailable.','Unknown current-inventory identities and any missing future prices can produce selection bias.',
       'Inspected historical data is not an untouched test. Only post-registration collections are prospective.']};
   await client.query('COMMIT');return {available:true as const,report};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function recordStrategyCoverage(collectionId?:number,asOf?:string) {
 const result=await getStrategyCoverage(collectionId,asOf);if(!result.report)return result;
 const r=result.report,hash=evidenceHash(r);
 await pool.query('INSERT INTO research_outcome_audits(collection_run_id,as_of,audit_hash,report) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',[r.collectionId,r.asOf,hash,JSON.stringify(r)]);
 const stored=(await pool.query('SELECT audit_hash FROM research_outcome_audits WHERE collection_run_id=$1 AND as_of=$2',[r.collectionId,r.asOf])).rows[0];
 if(stored.audit_hash!==hash)throw Error('Audit evidence changed for the same as-of; original record retained');
 return result;
}
