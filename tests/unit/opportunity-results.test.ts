import {describe,it,expect} from 'vitest';
import {summarizeOpportunityResults,type OpportunityOutcome} from '../../src/lib/opportunity-results';
const row=(ticker:string,overrides:Partial<OpportunityOutcome>={}):OpportunityOutcome=>({ticker,sources:['financial_filing'],financialPass:false,status:'entry_window_open',buy:null,sell:null,modeledNetUSD:null,...overrides});
describe('frozen-source net outcome summaries',()=>{
 it('retains every pending/missing outcome and counts actual closed costs once in the overall group',()=>{
 const rows=[row('WIN',{sources:['financial_filing','price_momentum','price_momentum'],financialPass:true,status:'complete_unverified',buy:{},sell:{},modeledNetUSD:100}),row('LOSS',{status:'complete_unverified',buy:{},sell:{},modeledNetUSD:-50}),row('FLAT',{status:'complete_unverified',buy:{},sell:{},modeledNetUSD:0}),row('OPEN',{buy:{},status:'not_mature'}),row('NOENTRY',{status:'entry_unavailable'}),row('PENDING'),row('NOEXIT',{buy:{},status:'exit_unavailable'}),row('INVALID',{buy:{},sell:{},status:'complete_unverified',modeledNetUSD:NaN})];
 const result=summarizeOpportunityResults(rows),all=result.groups[0];expect(all).toMatchObject({candidates:8,entries:6,closed:3,awaitingEntry:1,missingEntry:1,open:1,missingExit:2,wins:1,losses:1,flat:1,closedNetUSD:50,bestNetUSD:100,worstNetUSD:-50});expect(all.winRate).toBeCloseTo(100/3);
 expect(all.candidates).toBe(all.closed+all.awaitingEntry+all.missingEntry+all.open+all.missingExit);
 expect(result.groups.find(g=>g.name==='price_momentum')).toMatchObject({candidates:1,closed:1,closedNetUSD:100});expect(result.groups.find(g=>g.name==='Financial checks passed')).toMatchObject({candidates:1,closedNetUSD:100});
 expect(result.groups.find(g=>g.name==='Financial checks not passed or unknown')?.closedNetUSD).toBe(-50);
 });
 it('keeps unknown distinct from actual zero and never invents profit for an unfilled candidate',()=>{
 for(const rows of [[],[row('PENDING',{modeledNetUSD:999})],[row('OPEN',{buy:{},status:'not_mature'})]])expect(summarizeOpportunityResults(rows).groups[0]).toMatchObject({closed:0,closedNetUSD:null,winRate:null,bestNetUSD:null,worstNetUSD:null});
 expect(summarizeOpportunityResults([row('FLAT',{buy:{},sell:{},modeledNetUSD:0})]).groups[0].closedNetUSD).toBe(0);
 });
});
