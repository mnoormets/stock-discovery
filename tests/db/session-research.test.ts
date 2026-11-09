import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { refreshSessionResearch, SESSION_RESEARCH_TRIGGER } from '../../src/lib/session-research';
import { tryAcquireCollectionLock, releaseCollectionLock } from '../../src/lib/collection-lock';
import { resetDb } from '../setup/reset';
beforeEach(resetDb);
const now=new Date('2026-11-09T15:00:00Z');
async function snapshot(trigger:string,status='ok') {
 const result=await pool.query(`INSERT INTO collection_runs(trigger,status,started_at,finished_at,duration_ms,metrics) VALUES($1,'success',$2,$2,0,$3::jsonb) RETURNING id`,[trigger,now.toISOString(),JSON.stringify({nasdaqListings:{status,rows:[]}})]);return {collectionRunId:Number(result.rows[0].id)};
}
describe('regular-session research refresh',()=>{
 it('does no work before open, on weekends or after an early close',async()=>{
  for(const at of ['2026-11-09T12:00:00Z','2026-11-08T16:00:00Z','2026-11-27T18:10:00Z'])expect(await refreshSessionResearch({now:new Date(at),benchmark:async()=>{throw Error('no benchmark');},collect:async()=>{throw Error('no collection');}})).toEqual({skipped:'outside regular session'});
  expect((await pool.query('SELECT count(*)::int n FROM collection_runs')).rows[0].n).toBe(0);
 });
 it('captures benchmark before a new session snapshot, reuses it on replay and leaves morning history/trades intact',async()=>{
  await snapshot('morning');const before=(await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows;const calls:string[]=[];
  const first=await refreshSessionResearch({now,benchmark:async()=>{calls.push('benchmark');return true;},collect:async trigger=>{calls.push('collect');return snapshot(trigger);}});
  expect(first).toMatchObject({reused:false});expect(calls).toEqual(['benchmark','collect']);
  expect(await refreshSessionResearch({now:new Date(now.getTime()+60000),benchmark:async()=>{throw Error('reused');},collect:async()=>{throw Error('reused');}})).toMatchObject({collectionRunId:first.collectionRunId,reused:true});
  expect((await pool.query('SELECT * FROM collection_runs ORDER BY id')).rows[0]).toEqual(before[0]);
  expect((await pool.query('SELECT count(*)::int n FROM collection_runs')).rows[0].n).toBe(2);
  for(const table of ['paper_capital_trades','paper_strategy_orders'])expect((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n).toBe(0);
 });
 it('does not freeze without a benchmark or reuse a failed listing snapshot, and releases its lock for recovery',async()=>{
  await expect(refreshSessionResearch({now,benchmark:async()=>false,collect:async()=>{throw Error('must not collect');}})).rejects.toThrow('benchmark');
  await expect(refreshSessionResearch({now,benchmark:async()=>true,collect:trigger=>snapshot(trigger,'failed')})).rejects.toThrow('listing refresh');
  expect(await refreshSessionResearch({now,benchmark:async()=>true,collect:trigger=>snapshot(trigger)})).toMatchObject({reused:false});
  expect((await pool.query('SELECT count(*)::int n FROM collection_runs')).rows[0].n).toBe(2);
 });
 it('shares the canonical lock and never starts work while another collector owns it',async()=>{
  const owner=await pool.connect();try{
    expect(await tryAcquireCollectionLock(owner)).toBe(true);
    await expect(refreshSessionResearch({now,benchmark:async()=>{throw Error('should not benchmark');},collect:async()=>{throw Error('should not collect');}})).rejects.toThrow('shared lock');
    expect((await pool.query('SELECT count(*)::int n FROM collection_runs')).rows[0].n).toBe(0);
  }finally{await releaseCollectionLock(owner);owner.release();}
  expect(await refreshSessionResearch({now,benchmark:async()=>true,collect:trigger=>snapshot(trigger)})).toMatchObject({reused:false});
  expect(SESSION_RESEARCH_TRIGGER).toBe('regular-session-research-v1');
 });
});
