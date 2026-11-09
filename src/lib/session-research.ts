import { pool } from './db';
import { isExpectedNewYorkRegularSession, newYorkPriceDate } from './price-observation';
import { tryAcquireCollectionLock, releaseCollectionLock } from './collection-lock';
import { collectDefaultBenchmarkPrice } from './backtest';
import { runCollection } from './collect';
export const SESSION_RESEARCH_TRIGGER='regular-session-research-v1';
export async function refreshSessionResearch(options:{now?:Date;benchmark?:()=>Promise<boolean>;collect?:(trigger:string)=>Promise<{collectionRunId:number}>}={}) {
  const now=options.now??(await pool.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
  if(!isExpectedNewYorkRegularSession(now))return {skipped:'outside regular session'};
  const client=await pool.connect();let locked=false;
  try {
    locked=await tryAcquireCollectionLock(client);if(!locked)throw new Error('Another collection owns the shared lock.');
    const existing=(await client.query(`SELECT id FROM collection_runs WHERE trigger=$1 AND status='success'
      AND metrics->'nasdaqListings'->>'status'='ok' AND finished_at<=$2
      AND (started_at AT TIME ZONE 'America/New_York')::date=$3::date ORDER BY id DESC LIMIT 1`,[SESSION_RESEARCH_TRIGGER,now.toISOString(),newYorkPriceDate(now.toISOString())])).rows[0];
    if(existing)return {collectionRunId:Number(existing.id),reused:true};
    if(!await(options.benchmark??collectDefaultBenchmarkPrice)())throw new Error('Session benchmark capture unavailable.');
    const collected=await(options.collect??(trigger=>runCollection({trigger})))(SESSION_RESEARCH_TRIGGER);
    const snapshot=(await client.query("SELECT trigger,status,metrics->'nasdaqListings'->>'status' nasdaq_status FROM collection_runs WHERE id=$1",[collected.collectionRunId])).rows[0];
    if(snapshot?.trigger!==SESSION_RESEARCH_TRIGGER||snapshot.status!=='success'||snapshot.nasdaq_status!=='ok')throw new Error('Session listing refresh incomplete.');
    return {collectionRunId:collected.collectionRunId,reused:false};
  } finally {if(locked)await releaseCollectionLock(client);client.release();}
}
