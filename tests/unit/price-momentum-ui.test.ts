import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PriceMomentumReview from '../../src/components/PriceMomentumReview';
import { measureGrowthCohort } from '../../src/lib/growth-cohort';
import { evaluatePriceMomentum, PRICE_MOMENTUM_VERSION, type PriceMomentumReview as Review } from '../../src/lib/price-momentum';
const at='2026-11-09T16:00:00Z';const cohort=measureGrowthCohort([],[],at);
describe('transparent price momentum research UI',()=>{
 it('handles no frozen scan and no outcomes without implying profit',()=>{
  const html=renderToStaticMarkup(createElement(PriceMomentumReview,{cohort}));expect(html).toContain('No frozen price-momentum scan yet');expect(html).toContain('not trades, portfolio profit');
 });
 it('shows known trends, unknown coverage, timestamps, inputs and risk-stop separation',()=>{
  const stock={ticker:'TEST',name:'Test',price:120,marketAt:at,changePercent:1,marketCap:null,volume:null,relativeVolume:null,channels:[],warnings:[]};
  const row=evaluatePriceMomentum(stock,{meta:{symbol:'TEST',currency:'USD'},quotes:[30,90].map(d=>({date:new Date(Date.parse(at)-d*86400000),close:100}))},new Date(at));
  const scan:Review={version:PRICE_MOMENTUM_VERSION,evaluatedAt:at,rows:[row,{...row,ticker:'MISSING',state:'unknown' as const,priceContext:null,reasons:['No history']}]};
  const html=renderToStaticMarkup(createElement(PriceMomentumReview,{cohort,scan}));expect(html).toContain('1 candidates / 2 observed names');expect(html).toContain('MISSING: unknown');expect(html).toContain('20.00%');expect(html).toContain('Completed-day history inputs');expect(html).toContain('capital risk stop');expect(html).toContain(at);
 });
});

