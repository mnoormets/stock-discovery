import { describe, expect, it } from 'vitest';
import { evaluatePriceMomentum } from '../../src/lib/price-momentum';
import type { MarketRadarStock } from '../../src/lib/market-radar';
import type { EarlyHistory } from '../../src/lib/early-opportunities';
const now = new Date('2026-11-09T16:00:00Z');
const stock: MarketRadarStock = { ticker:'TEST',name:'Test',price:120,marketAt:now.toISOString(),changePercent:2,
  marketCap:null,volume:null,relativeVolume:null,channels:['day_gainers'],warnings:[] };
const chart = (): EarlyHistory => ({meta:{symbol:'TEST',currency:'USD'},quotes:[30,90].map(d=>({date:new Date(now.getTime()-d*86400000),close:100}))});
describe('independent frozen price momentum',()=>{
  it('observes positive 1/3-month trends without requiring cash-flow evidence or six-month history',()=>{
    const row=evaluatePriceMomentum(stock,chart(),now);expect(row.state).toBe('observe');
    expect(row.priceContext).toMatchObject({oneMonthReturnPercent:20,threeMonthReturnPercent:20,sixMonthReturnPercent:null});
  });
  it('keeps missing references unknown and flat or falling references out of observations',()=>{
    expect(evaluatePriceMomentum(stock,null,now).state).toBe('unknown');
    const c=chart();c.quotes.pop();expect(evaluatePriceMomentum(stock,c,now).state).toBe('unknown');
    c.quotes.push({date:new Date(now.getTime()-90*86400000),close:150});expect(evaluatePriceMomentum(stock,c,now).state).toBe('declining_or_flat');
  });
  it('rejects stale/future quotes, identity/currency mismatches and splits',()=>{
    for(const at of ['2026-11-01T16:00:00Z','2026-11-10T16:00:00Z'])expect(evaluatePriceMomentum({...stock,marketAt:at},chart(),now).state).toBe('unknown');
    for(const c of [{...chart(),meta:{symbol:'OTHER',currency:'USD'}},{...chart(),meta:{symbol:'TEST',currency:'EUR'}},{...chart(),events:{splits:[{}]}}])expect(evaluatePriceMomentum(stock,c,now).state).toBe('unknown');
  });
  it('ignores the current-day bar and all prices not known by the quote',()=>{
    const c=chart();c.quotes.push({date:new Date('2026-11-09T14:30:00Z'),close:999},{date:new Date('2026-11-10T14:30:00Z'),close:1});
    expect(evaluatePriceMomentum(stock,c,now).priceContext?.observationCount).toBe(2);
  });
});
