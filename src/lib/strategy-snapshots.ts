import { pool } from './db';
import { RESEARCH_PROTOCOLS, evidenceHash, validateProtocol, protocolHash, engineManifest } from './strategy-protocols';
import { evaluateResearchProtocol, knownShares, type KnownFact, type ResearchInputs, type ResearchMember } from './strategy-signal-evaluation';
import { selectGrowthEvidence } from './growth-opportunities';
import type { DiscoveryEvidence } from './discovery-evidence';
const cik=(value:unknown)=>/^\d{1,10}$/.test(String(value??''))&&Number(value)>0?String(value).padStart(10,'0'):null;
export async function researchSchemaAvailable() {return (await pool.query("SELECT to_regclass('public.research_protocols') IS NOT NULL ok")).rows[0].ok===true;}
export async function registerResearchProtocols() {
 if(!await researchSchemaAvailable())return false;
 for(const p of RESEARCH_PROTOCOLS){validateProtocol(p);const manifest=engineManifest(),hash=protocolHash(p,manifest);
   await pool.query('INSERT INTO research_protocols(strategy_id,version,definition,version_hash,engine_manifest) VALUES($1,$2,$3::jsonb,$4,$5::jsonb) ON CONFLICT DO NOTHING',[p.id,p.version,JSON.stringify(p),hash,JSON.stringify(manifest)]);
   const row=(await pool.query('SELECT definition,version_hash,engine_manifest FROM research_protocols WHERE strategy_id=$1 AND version=$2',[p.id,p.version])).rows[0];
   if(row.version_hash!==hash||evidenceHash(row.definition)!==evidenceHash(p)||evidenceHash(row.engine_manifest)!==evidenceHash(manifest))throw Error('Immutable research protocol mismatch: '+p.id);
 }return true;
}
/** Called only while a NEW collection is running; never retrofits older observations. */
export async function freezeResearchCollection(collectionId:number,evidence:DiscoveryEvidence,extraTickers:string[]=[]) {
 if(!await researchSchemaAvailable())return {available:false};
 const client=await pool.connect();
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
   await client.query("SELECT pg_advisory_xact_lock(hashtext('research-freeze:'||$1::text))",[collectionId]);
   const existing=(await client.query('SELECT source_hash FROM research_universes WHERE collection_run_id=$1',[collectionId])).rows[0];
   if(existing){await client.query('COMMIT');return {available:true,reused:true,sourceHash:existing.source_hash};}
   const run=(await client.query('SELECT status,started_at FROM collection_runs WHERE id=$1',[collectionId])).rows[0];
   const registered=(await client.query('SELECT strategy_id,version,version_hash,registered_at FROM research_protocols WHERE (strategy_id,version) IN (SELECT x.id,x.version FROM jsonb_to_recordset($1::jsonb) x(id text,version int)) ORDER BY strategy_id',[JSON.stringify(RESEARCH_PROTOCOLS.map(p=>({id:p.id,version:p.version})))])).rows;
   if(!run||run.status!=='running'||registered.length!==RESEARCH_PROTOCOLS.length||registered.some(p=>p.registered_at>run.started_at))
     throw Error('Research freeze requires a new collection started after protocol registration');
   const now=(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now,at=now.toISOString();
   const companies=(await client.query('SELECT * FROM companies WHERE created_at<=$1',[at])).rows;
   const prices=(await client.query("SELECT DISTINCT ON(company_id) company_id,market_cap,captured_at,market_at FROM price_snapshots WHERE captured_at<=$1 AND market_at<=$1 AND market_cap>0 AND currency='USD' AND captured_at>=$1::timestamptz-interval '30 days' ORDER BY company_id,captured_at DESC,id DESC",[at])).rows;
   const raw=(await client.query("SELECT f.*,to_char(period_start,'YYYY-MM-DD') period_start,to_char(period_end,'YYYY-MM-DD') period_end,to_char(filed_at,'YYYY-MM-DD') filed_at FROM financial_facts f WHERE metric IN ('revenue','operating_cash_flow','shares_outstanding') AND updated_at<=$1 AND filed_at<=$1::date AND period_end>=$1::date-800 ORDER BY f.company_id,f.period_end DESC,f.filed_at DESC,f.id DESC",[at])).rows;
   const facts=new Map<string,KnownFact[]>();for(const f of raw){const point:KnownFact={id:Number(f.id),metric:f.metric,value:Number(f.value),unit:f.unit,periodStart:f.period_start,
     periodEnd:f.period_end,periodKind:f.period_kind,fiscalYear:f.fiscal_year,fiscalPeriod:f.fiscal_period,form:f.form_type,filedAt:f.filed_at,
     accessionNumber:f.accession_number,taxonomy:f.taxonomy,tag:f.tag,derived:f.is_derived,sourceUrl:f.source_url,knownAt:f.updated_at.toISOString()};
     facts.set(String(f.company_id),[...(facts.get(String(f.company_id))??[]),point]);}
   const byTicker=new Map(companies.map(c=>[c.ticker,c])),caps=new Map(prices.map(p=>[String(p.company_id),p]));
   const members=new Map<string,ResearchMember>();
   const add=(ticker:string,issuer:string|null,name:string,inInventory:boolean,source:string)=>{
     const c=byTicker.get(ticker),cap=c?caps.get(String(c.id)):null,key=ticker+'|'+(issuer??'unknown');
     if(!issuer){const known=[...members.values()].find(m=>m.ticker===ticker);if(known){if(!known.discoverySources.includes(source))known.discoverySources.push(source);return;}}
     const old=members.get(key);if(old){old.inInventory ||= inInventory;if(!old.discoverySources.includes(source))old.discoverySources.push(source);return;}
     const all=c?facts.get(String(c.id))??[]:[],selected=[...selectGrowthEvidence(all,now),...knownShares(all,at)] as KnownFact[];
     members.set(key,{key,ticker,name,cik:issuer,companyId:c?String(c.id):null,inInventory,discoverySources:[source],
       discoveredAt:c?.created_at?.toISOString()??evidence.universeObservedAt??at,
       identityKnownAt:c&&c.updated_at<=now?c.updated_at.toISOString():null,storedCIK:cik(c?.sec_cik),
       quoteType:c?.quote_type??null,currency:c?.currency??null,exchange:c?.exchange??null,
       marketCapUSD:cap?Number(cap.market_cap):null,marketCapKnownAt:cap?.captured_at?.toISOString()??null,marketCapMarketAt:cap?.market_at?.toISOString()??null,
       facts:[...new Map(selected.map(f=>[f.id,f])).values()],availableFactCount:all.length});
   };
   for(const row of evidence.universe??[])add(row.ticker,row.cik,row.name,evidence.universeStatus==='sec','sec_inventory');
   for(const c of companies)add(c.ticker,cik(c.sec_cik),c.name??c.ticker,false,'stored_issuer');
   const items=(await client.query('SELECT ticker FROM collection_run_items WHERE collection_run_id=$1',[collectionId])).rows;
   for(const t of [...items.map(r=>r.ticker),...extraTickers]){const c=byTicker.get(t);add(t,cik(c?.sec_cik),c?.name??t,false,'collection_observation');}
   const prior=(await client.query("SELECT metrics->'discoveryEvidence'->'filings' filings FROM collection_runs WHERE status='success' AND finished_at<=$1 ORDER BY id DESC LIMIT 1",[run.started_at])).rows[0]?.filings??[];
   const inputs:ResearchInputs={collectionId,collectionStartedAt:run.started_at.toISOString(),frozenAt:at,
     inventoryObservedAt:evidence.universeObservedAt??at,inventoryStatus:evidence.universeStatus==='sec'&&evidence.universe?.length?'complete_inventory':'partial_inventory',
     inventoryCount:evidence.universe?.length??0,members:[...members.values()].sort((a,b)=>a.key.localeCompare(b.key)),filings:evidence.filings,priorEventKeys:[...new Set<string>(prior.map(f=>f.cik+'|'+f.form+'|'+f.filedAt))]};
   const hash=evidenceHash(inputs);
   await client.query('INSERT INTO research_universes(collection_run_id,frozen_at,inventory_status,source_hash,member_count,inputs) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[collectionId,at,inputs.inventoryStatus,hash,inputs.members.length,JSON.stringify(inputs)]);
   for(const protocol of RESEARCH_PROTOCOLS){const rows=evaluateResearchProtocol(inputs,protocol);
     await client.query('INSERT INTO research_strategy_snapshots(collection_run_id,strategy_id,version,version_hash,snapshot_hash,rows) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
       [collectionId,protocol.id,protocol.version,protocolHash(protocol),evidenceHash(rows),JSON.stringify(rows)]);
   }await client.query('COMMIT');return {available:true,reused:false,members:members.size,sourceHash:hash};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
