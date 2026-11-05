import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RadarLeads from '../../src/components/RadarLeads';
import type { MarketRadarSnapshot, MarketRadarStock } from '../../src/lib/market-radar';
const now='2026-10-09T20:05:00Z';
const stock: MarketRadarStock={ticker:'MRNA',name:'Moderna',price:225,changePercent:14.21,marketAt:'2026-10-09T20:00:00Z',marketCap:null,volume:null,relativeVolume:null,channels:['day_gainers'],warnings:[]};
const snapshot: MarketRadarSnapshot={version:'market-radar-v1',observedAt:now,channels:[],stocks:[stock],growth:{version:'growth-opportunities-v2',evaluatedAt:now,historyAttempted:0,historyDeferred:0,rows:[{ticker:'MRNA',name:'Moderna',state:'excluded',price:225,marketAt:stock.marketAt,revenueGrowth:113.6,facts:[],priceContext:null,reasons:['Operating cash flow -$1,156,000,000; positive cash flow required.']} ]}};
const render=(s=snapshot,firstSeen: Record<string,{at:string;price:number|null}>={MRNA:{at:'2026-10-07T16:01:02Z',price:193.465}})=>renderToStaticMarkup(createElement(RadarLeads,{snapshot:s,firstSeen,now}));
describe('prominent radar movers',()=>{
  it('keeps negative-cash-flow exclusions visible with first actual discovery evidence',()=>{
    const html=render();expect(html).toContain('MRNA');expect(html).toContain('14.21%');expect(html).toContain('193.47');expect(html).toContain('excluded');expect(html).toContain('1,156,000,000');expect(html).toContain('not a forecast');
  });
  it('does not promote stale, future or missing quotes and remains safe without growth or history',()=>{
    for(const marketAt of ['2026-10-01T20:00:00Z','2026-10-10T20:00:00Z',null])expect(render({...snapshot,stocks:[{...stock,marketAt}]})).not.toContain('href="/company/MRNA"');
    expect(render({...snapshot,stocks:[{...stock,price:null}]})).toContain('No positive movers');
    const html=render({...snapshot,growth:undefined},{});expect(html).toContain('First observation unavailable');expect(html).toContain('Growth evidence unavailable');
  });
  it('limits by session gain without filtering financial eligibility or mutating the snapshot',()=>{
    const stocks=Array.from({length:7},(_,i)=>({...stock,ticker:'T'+i,changePercent:i+1}));const s={...snapshot,stocks};const html=render(s);expect(html).toContain('/company/T6');expect(html).not.toContain('/company/T0');expect(s.stocks[0].ticker).toBe('T0');
  });
});
