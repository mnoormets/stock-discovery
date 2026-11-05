import { describe, expect, it } from 'vitest';
import { capitalSplitIssue as evaluateSplitIssue } from '../../src/lib/paper-capital-splits';
const history={meta:{symbol:'AAA',currency:'USD'},quotes:[{date:new Date('2026-10-06'),close:100}]};
const capitalSplitIssue=(ticker: string, chart: Parameters<typeof evaluateSplitIssue>[1])=>evaluateSplitIssue(ticker,chart,new Date('2026-10-06'),new Date('2026-10-07'));
describe('capital split integrity',()=>{
  it('accepts known matching USD history without a reported split',()=>{
    expect(capitalSplitIssue('AAA',history)).toBeNull();
  });
  it('requires reconciliation for ordinary and reverse splits',()=>{
    for (const splitRatio of ['2:1','1:20']) expect(capitalSplitIssue('AAA',{...history,events:{splits:[{splitRatio}]}})).toContain('reconciliation');
  });
  it('does not treat missing prices or wrong identity/currency as verified absence',()=>{
    expect(capitalSplitIssue('BBB',history)).toContain('unavailable');
    expect(capitalSplitIssue('AAA',{...history,meta:{symbol:'AAA',currency:'EUR'}})).toContain('unavailable');
    expect(capitalSplitIssue('AAA',{...history,quotes:[]})).toContain('unavailable');
    expect(capitalSplitIssue('AAA',{...history,quotes:[{date:new Date('2026-09-01'),close:100}]})).toContain('unavailable');
  });
});

describe('entry-day daily chart cutoff',()=>{
  const start=new Date('2026-10-09T00:00:00Z');
  const now=new Date('2026-10-09T16:00:25.619Z');
  const chart={meta:{symbol:'NVDA',currency:'USD'},quotes:[
    {date:new Date('2026-10-08T13:30:00Z'),close:237.47},
    {date:new Date('2026-10-09T16:00:42Z'),close:229.185},
  ]};
  it('uses preceding price context for identity without accepting the live bar after cutoff',()=>{
    expect(evaluateSplitIssue('NVDA',chart,start,now)).toBeNull();
    expect(evaluateSplitIssue('NVDA',{...chart,quotes:[chart.quotes[1]]},start,now)).toContain('unavailable');
  });
  it('ignores only dated splits strictly before entry day',()=>{
    expect(evaluateSplitIssue('NVDA',{...chart,events:{splits:[{date:new Date('2026-10-08'),splitRatio:'2:1'}]}},start,now)).toBeNull();
    for(const date of [new Date('2026-10-09'),new Date('2026-10-10'),new Date('invalid')])
      expect(evaluateSplitIssue('NVDA',{...chart,events:{splits:[{date,splitRatio:'2:1'}]}},start,now)).toContain('reconciliation');
    expect(evaluateSplitIssue('NVDA',{...chart,events:{splits:[{splitRatio:'2:1'}]}},start,now)).toContain('reconciliation');
  });
  it('rejects stale context and identity or currency mismatches',()=>{
    expect(evaluateSplitIssue('NVDA',{...chart,quotes:[{date:new Date('2026-10-01'),close:230}]},start,now)).toContain('unavailable');
    expect(evaluateSplitIssue('NVDA',{...chart,meta:{symbol:'NVDA',currency:'EUR'}},start,now)).toContain('unavailable');
    expect(evaluateSplitIssue('AMD',chart,start,now)).toContain('unavailable');
  });
});
