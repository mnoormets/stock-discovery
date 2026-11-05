import { describe,expect,it } from 'vitest';
import { measureGrowthCohort,type CohortPoint } from '../../src/lib/growth-cohort';
import { collectionBuildProvenance } from '../../src/lib/collection-build';
const point=(ticker:string,at:string,price:number|null,state='early'):CohortPoint=>({ticker,state,observedAt:at,marketAt:at,price});
const start='2026-10-01T15:00:00Z',end='2026-10-08T15:00:00Z',now='2026-10-10T15:00:00Z';
describe('complete discovery cohort',()=>{
  it('retains rejected candidates and missing outcomes rather than cherry-picking winners',()=>{
    const rows=[point('WIN',start,100),point('WIN',end,120),point('LOSE',start,100,'excluded'),point('LOSE',end,90,'early'),point('GAP',start,100)];
    const r=measureGrowthCohort(rows,[],now);expect(r.rows).toHaveLength(3);
    expect(r.rows.find(r=>r.ticker==='LOSE')).toMatchObject({group:'excluded',priceChangePercent:-9.999999999999998});
    expect(r.groups.find(r=>r.group==='early')).toMatchObject({total:2,measured:1,missing:1});
  });
  it('does not replace missing first prices, use future observations or accept late hindsight fills',()=>{
    const r=measureGrowthCohort([point('A',start,null),point('A',end,120),point('B',start,100),point('B','2026-10-09T15:00:00Z',120),point('C',now,100)],[], '2026-10-08T16:00:00Z');
    expect(r.rows.find(r=>r.ticker==='A')?.status).toBe('baseline_unavailable');expect(r.rows.find(r=>r.ticker==='B')?.status).toBe('endpoint_unavailable');expect(r.rows.some(r=>r.ticker==='C')).toBe(false);
    const future=point('A',start,100);future.marketAt='2026-10-02T15:00:00Z';
    expect(measureGrowthCohort([future],[],now).rows[0].status).toBe('baseline_unavailable');
    expect(measureGrowthCohort([point('A',start,100),point('A','2026-10-12T16:00:00Z',200)],[],'2026-10-20T15:00:00Z').rows[0].status).toBe('endpoint_unavailable');
  });
  it('pairs benchmarks only when aligned and available at the original decision',()=>{
    const points=[point('A',start,100),point('A',end,120)];
    const benchmark=[{marketAt:start,observedAt:start,price:100},{marketAt:end,observedAt:end,price:110}];
    expect(measureGrowthCohort(points,benchmark,now).rows[0].excessPriceChangePercent).toBeCloseTo(10);
    benchmark[0].observedAt=end;expect(measureGrowthCohort(points,benchmark,now).rows[0].excessPriceChangePercent).toBeNull();
    expect(()=>measureGrowthCohort([],[],now,5)).toThrow();
  });
});
describe('sanitized collection provenance',()=>{
  it('records declared revision without exposing arbitrary environment values',()=>{
    expect(collectionBuildProvenance({GITHUB_SHA:'a'.repeat(40),GITHUB_ACTIONS:'true',GITHUB_RUN_ID:'123'})).toMatchObject({revision:'a'.repeat(40),runner:'github_actions',runId:'123'});
    expect(collectionBuildProvenance({GITHUB_SHA:'secret-url',GITHUB_RUN_ID:'token'})).toMatchObject({revision:null,runId:null});
  });
});
