import { pool } from './db';
import { researchSchemaAvailable } from './strategy-snapshots';
import { RESEARCH_PROTOCOLS, protocolHash } from './strategy-protocols';
/** Read an immutable recorded audit for display; never recompute or write on page load. */
export async function getStoredStrategyCoverage(collectionId?:number) {
 if(!await researchSchemaAvailable())return {available:false,report:null,notice:'Measurement migration required.'};
 const hashes=RESEARCH_PROTOCOLS.map(p=>protocolHash(p));
 const selected=(await pool.query(`SELECT u.collection_run_id,(SELECT id FROM research_outcome_audits a WHERE a.collection_run_id=u.collection_run_id ORDER BY as_of DESC LIMIT 1) audit_id
   FROM research_universes u JOIN collection_runs c ON c.id=u.collection_run_id
   WHERE c.status='success' AND ($1::bigint IS NULL OR u.collection_run_id=$1)
   AND ($1::bigint IS NOT NULL OR (SELECT count(*) FROM research_strategy_snapshots s WHERE s.collection_run_id=u.collection_run_id AND s.version_hash=ANY($2::text[]))=$3)
   ORDER BY u.frozen_at LIMIT 1`,[collectionId??null,hashes,RESEARCH_PROTOCOLS.length])).rows[0];
 if(!selected?.audit_id)return {available:true,report:null,notice:selected?'Prospective snapshot exists; no recorded outcome audit yet. Run the coverage CLI with --record.':'No prospective collection for the active protocol revision yet.'};
 const header=(await pool.query("SELECT report-'strategies' head FROM research_outcome_audits WHERE id=$1",[selected.audit_id])).rows[0].head;
 const parts=(await pool.query(`SELECT s-'rows' summary,
   (SELECT jsonb_agg(x) FROM jsonb_array_elements(s->'rows') x WHERE x->>'uiStatus'='eligible_visible') visible,
   (SELECT jsonb_agg(value) FROM (SELECT x value FROM jsonb_array_elements(s->'rows') x
     WHERE jsonb_array_length(x->'reasons')>0 OR jsonb_array_length(x->'missingComponents')>0 LIMIT 40) examples) gaps
   FROM research_outcome_audits a CROSS JOIN LATERAL jsonb_array_elements(a.report->'strategies') s WHERE a.id=$1`,[selected.audit_id])).rows;
 const strategies=parts.map(p=>{const same=hashes.includes(p.summary.versionHash);
   return {...p.summary,rows:[...new Map([...(p.visible??[]),...(p.gaps??[])].map(r=>[r.key,r])).values()],
     recordedReproducible:p.summary.reproducible,reproducible:same&&p.summary.reproducible,engineMatches:same};});
 const historical=strategies.some(s=>!s.engineMatches);
 return {available:true,report:{...header,auditId:String(selected.audit_id),strategies,historicalAudit:historical,
   engineWarning:historical?'Recorded immutable audit from an earlier source revision; not recomputed with the current engine.':null},
   notice:'Recorded as-of audit. Page reads only compact display rows; full denominators and details remain in the audit ledger/CLI.'};
}
