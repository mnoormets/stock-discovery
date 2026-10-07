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
