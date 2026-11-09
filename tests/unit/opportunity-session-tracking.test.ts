import {describe,it,expect} from 'vitest';
import {selectPriceTrackingBatch} from '../../src/lib/price-tracking';
const row=(ticker:string,reasons:string[])=>({ticker,company_id:ticker,reasons,last_attempt:null});
const queue=[row('SPY',['benchmark']),...Array.from({length:12},(_,i)=>row('IPO'+i,['new Nasdaq listing'])),...Array.from({length:15},(_,i)=>row('PAPER'+i,['unified opportunity quote v1'])),...Array.from({length:60},(_,i)=>row('OTHER'+i,['research']))];
describe('live paper quote capacity',()=>{
 it('retains session capacity before open without spending attempts on prior closes or raising fifty',()=>{
 const before=selectPriceTrackingBatch(queue,0,new Date('2026-11-10T13:00:00Z'));expect(before).toHaveLength(30);expect(before[0].ticker).toBe('SPY');expect(before.every(x=>!x.ticker.startsWith('IPO')&&!x.ticker.startsWith('PAPER'))).toBe(true);
 const after=selectPriceTrackingBatch(queue,30,new Date('2026-11-10T15:00:00Z'));expect(after).toHaveLength(20);expect(after.some(x=>x.ticker.startsWith('PAPER'))).toBe(true);expect(after.some(x=>x.ticker.startsWith('IPO'))).toBe(true);
 });
 it('lets capital coverage consume reservations and stays closed on weekends',()=>{
 const critical=Array.from({length:50},(_,i)=>row('HELD'+i,['capital holding']));expect(selectPriceTrackingBatch([...critical,...queue],0,new Date('2026-11-10T13:00:00Z')).every(x=>x.reasons.includes('capital holding'))).toBe(true);
 expect(selectPriceTrackingBatch(queue,49,new Date('2026-11-10T15:00:00Z'))).toHaveLength(1);expect(selectPriceTrackingBatch(queue,50,new Date('2026-11-10T15:00:00Z'))).toEqual([]);
 expect(selectPriceTrackingBatch(queue,0,new Date('2026-11-14T15:00:00Z')).some(x=>x.ticker.startsWith('PAPER'))).toBe(false);
 });
});
