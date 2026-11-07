import { describe, expect, it } from 'vitest';
import { evaluateListingEntries, type ListingEntryObservation, type ListingEntryQuote } from '../../src/lib/listing-entry-evaluation';
const first:ListingEntryObservation={ticker:'TEST',collectionId:'1',discoveredAt:'2026-10-12T13:40:00Z',financialPass:false};
const q=(marketAt:string,price=100,capturedAt=marketAt,currency='USD'):ListingEntryQuote=>({id:marketAt,ticker:'TEST',marketAt,capturedAt,currency,price});
const asOf='2026-10-25T14:00:00Z',entry=q('2026-10-12T14:00:00Z'),exit=q('2026-10-19T14:00:00Z');
describe('frozen listing entry evaluation',()=>{
 it('withholds pre-discovery, delayed, foreign, future-known and non-session entry evidence',()=>{
  for(const quote of [q(first.discoveredAt),q('2026-10-12T13:39:00Z'),q('2026-10-12T14:00:00Z',100,'2026-10-12T14:21:00Z'),q('2026-10-12T14:00:00Z',100,undefined,'EUR'),q('2026-10-12T14:00:00Z',100,'2026-11-01T14:00:00Z'),q('2026-10-12T12:00:00Z')])expect(evaluateListingEntries([first],[quote],asOf).rows[0]).toMatchObject({status:'entry_unavailable',modeledNetUSD:null});
 });
 it('keeps first discovery and financial state despite later passing observations',()=>{
  const later={...first,collectionId:'2',discoveredAt:'2026-10-13T14:00:00Z',financialPass:true};
  const r=evaluateListingEntries([later,first],[entry,exit],asOf);
  expect(r.rows).toHaveLength(1);expect(r.rows[0]).toMatchObject({collectionId:'1',financialPass:false});
  expect(r.groups.find(g=>g.phase==='retrospective'&&g.arm==='financial_pass')?.total).toBe(0);
 });
 it('charges both commissions and slippage so a flat price loses, without summing a portfolio profit',()=>{
  const r=evaluateListingEntries([first],[exit,entry],asOf).rows[0];
  expect(r.status).toBe('unverified_quote_scenario');expect(r.modeledNetUSD).toBeCloseTo(-2.9985007496,8);
  expect(r.entry?.marketAt).toBe(entry.marketAt);expect(r.exit?.marketAt).toBe(exit.marketAt);
 });
 it('retains missing and immature exits in denominators rather than assigning zero',()=>{
  const r=evaluateListingEntries([first],[entry],asOf);
  expect(r.rows[0]).toMatchObject({status:'exit_unavailable',modeledNetUSD:null});expect(r.groups[0]).toMatchObject({total:1,missing:1,completeScenarios:0,meanModeledNetUSD:null});
  expect(evaluateListingEntries([first],[entry],'2026-10-13T14:00:00Z').rows[0].status).toBe('not_mature');
 });
 it('separates prospective discoveries and rejects observations after the evaluation clock',()=>{
  const future={...first,discoveredAt:'2026-11-09T14:00:00Z'};
  expect(evaluateListingEntries([first,future],[],asOf).rows).toHaveLength(1);
  expect(evaluateListingEntries([future],[],'2026-11-09T15:00:00Z').groups.find(g=>g.phase==='prospective'&&g.arm==='all_confirmed')).toMatchObject({total:1,pending:1});
 });
 it('does not turn null, nonpositive or future market prices into scenarios',()=>{
  for(const quote of [{...entry,price:null},{...entry,price:0},{...entry,marketAt:null},{...entry,marketAt:'2026-10-12T15:00:00Z',capturedAt:'2026-10-12T14:00:00Z'}])expect(evaluateListingEntries([first],[quote],asOf).rows[0].entry).toBeNull();
 });
});
