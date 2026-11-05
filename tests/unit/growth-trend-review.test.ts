import { describe, expect, it } from 'vitest';
import { reviewGrowthTrends, type GrowthOpportunity } from '../../src/lib/growth-opportunities';
const row=(ticker:string,one:number|null,three:number|null,state:GrowthOpportunity['state']='early')=>({ticker,state,priceContext:{oneMonthReturnPercent:one,threeMonthReturnPercent:three}} as GrowthOpportunity);
describe('versioned forward trend research',()=>{
  it('distinguishes falling setups from positive trends without ticker or future-return preferences',()=>{
    const rows=[row('AAA',-16,-33),row('BBB',11,6),row('CCC',3,4,'momentum'),row('DDD',0,1)];
    const before=JSON.stringify(rows);const result=reviewGrowthTrends(rows);
    expect(result.version).toBe('growth-trend-review-v1');
    expect(result.rows.map(r=>r.state)).toEqual(['declining_or_flat','observe','observe','declining_or_flat']);
    expect(JSON.stringify(rows)).toBe(before);expect(result.rule).toContain('no orders');
  });
  it('does not turn missing history or rejected fundamentals into positive research',()=>{
    expect(reviewGrowthTrends([row('AAA',null,1),row('BBB',NaN,2),row('CCC',20,30,'excluded')]).rows.map(r=>r.state)).toEqual(['unknown','unknown','not_qualified']);
  });
});
