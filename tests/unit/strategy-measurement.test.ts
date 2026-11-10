import {describe,expect,it} from 'vitest';
import {RESEARCH_PROTOCOLS,evidenceHash,protocolHash,engineManifest,referenceWindow,tradingSession,addTradingSessions,validateProtocol} from '../../src/lib/strategy-protocols';
import {evaluateResearchProtocol,replaySnapshot} from '../../src/lib/strategy-signal-evaluation';
import {auditResearchSignals,type ResearchQuote} from '../../src/lib/strategy-outcome-audit';
import {researchFacts,researchInput,researchMember,frozenAt} from '../fixtures/strategy-measurement';
const [fund,news]=RESEARCH_PROTOCOLS;
const quote=(id:string,companyId:string,ticker:string,price:number,at:string):ResearchQuote=>({id,companyId,ticker,price,currency:'USD',source:'yahoo',marketAt:at,capturedAt:new Date(Date.parse(at)+1000).toISOString()});
describe('locked two-protocol measurement',()=>{
 it('binds JSON definitions and executable engine sources without relying on object key order',()=>{
  expect(evidenceHash({b:2,a:1})).toBe(evidenceHash({a:1,b:2}));RESEARCH_PROTOCOLS.forEach(validateProtocol);
  const m=engineManifest();expect(protocolHash(fund,m)).not.toBe(protocolHash(fund,{...m,'price-observation.ts':'changed'}));
  expect(()=>validateProtocol({...fund,horizonsTradingDays:[0]})).toThrow();
 });
 it('keeps all assessed names, complete ranks and UI-only exclusions',()=>{
  const members=Array.from({length:9},(_,i)=>researchMember('NAME'+i,String(i+1)));
  const missing={...researchMember('MISSING','10'),facts:[],quoteType:null};
  const input=researchInput([...members,missing]),rows=evaluateResearchProtocol(input,fund);
  expect(rows).toHaveLength(10);expect(rows.filter(r=>r.eligibility==='eligible')).toHaveLength(9);
  expect(rows.filter(r=>r.uiStatus==='eligible_ui_cap_excluded')).toHaveLength(3);
  expect(rows.find(r=>r.ticker==='MISSING')!.missingComponents).toContain('coherent_revenue_growth');
  expect(replaySnapshot(JSON.parse(JSON.stringify(input)),fund,rows)).toBe(true);
 });
 it('excludes future-known, incoherent and negative cash flow instead of converting them into missing zeros',()=>{
  for(const change of ['future','period','negative'] as const){
    const m=researchMember();if(change==='future')m.facts[0].knownAt='2026-11-11T14:00:00Z';
    if(change==='period')m.facts[2].accessionNumber='different';if(change==='negative')m.facts[2].value=-10;
    expect(evaluateResearchProtocol(researchInput([m]),fund)[0].eligibility).toBe('ineligible');
  }
 });
 it('uses a declared same-tag basic-share proxy and does not hide excessive or missing dilution',()=>{
  const m=researchMember();m.facts[3].value=110;expect(evaluateResearchProtocol(researchInput([m]),fund)[0].reasons).toContain('basic_shares_growth_above_5');
  m.facts=researchFacts();m.facts[3].value=105;m.facts[4].value=100;
  expect(evaluateResearchProtocol(researchInput([m]),fund)[0].eligibility).toBe('eligible');
  for(const exchange of ['NasdaqGS','NasdaqGM','NasdaqCM']){m.exchange=exchange;expect(evaluateResearchProtocol(researchInput([m]),fund)[0].eligibility).toBe('eligible');}
  m.facts=researchFacts();m.facts[4].tag='DifferentClass';expect(evaluateResearchProtocol(researchInput([m]),fund)[0].reasons).toContain('basic_shares_growth_unavailable');
 });
 it('requires a fresh official issuer-linked event, not a headline, repeated URL variant or future receipt',()=>{
  const good=researchInput();expect(evaluateResearchProtocol(good,news)[0].eligibility).toBe('eligible');
  for(const kind of ['secondary','wrong_cik','old_receipt','future','repeat'] as const){
   const input=researchInput();if(kind==='secondary')input.filings[0].url='https://publisher.test/story';
   if(kind==='wrong_cik')input.filings[0].url='https://www.sec.gov/Archives/edgar/data/2/a.txt';
   if(kind==='old_receipt')input.filings[0].observedAt='2026-11-10T14:00:00Z';
   if(kind==='future')input.filings[0].observedAt='2026-11-11T15:00:00Z';
   if(kind==='repeat')input.priorEventKeys=['0000000001|10-Q|2026-11-10'];
   expect(evaluateResearchProtocol(input,news)[0].eligibility).toBe('ineligible');
  }
 });
 it('does not substitute a benchmark for unknown frozen market cap',()=>{
  const m=researchMember();m.marketCapUSD=null;const row=evaluateResearchProtocol(researchInput([m]),fund)[0];
  expect(row.benchmark).toBeNull();expect(row.missingComponents).toContain('benchmark_assignment');
 });
 it('uses actual sessions including DST, holidays and early closes',()=>{
  expect(tradingSession('2026-11-26')).toBeNull();expect(tradingSession('2026-11-27')!.close).toBe('2026-11-27T18:00:00.000Z');
  expect(addTradingSessions('2026-11-25',1)).toBe('2026-11-27');
  expect(tradingSession('2026-03-06')!.open).toBe('2026-03-06T14:30:00.000Z');
  expect(tradingSession('2026-03-09')!.open).toBe('2026-03-09T13:30:00.000Z');
  expect(referenceWindow('2026-11-27T18:00:00.000Z')!.earliest).toBe('2026-11-30T14:30:00.000Z');
  expect(tradingSession('2029-01-02')).toBeNull();
  expect(referenceWindow('2026-11-27T17:59:59.999Z')!.earliest).toBe('2026-11-30T14:30:00.000Z');
 });
 it('compares eligible and excluded controls without dropping missing outcomes or crediting corporate actions',()=>{
  const first=researchMember(),second=researchMember('CONTROL','2'),rows=evaluateResearchProtocol(researchInput([first,second]),news);
  const quotes=[quote('1','1','KNOWN',100,'2026-11-10T15:01:00Z'),quote('2','2','CONTROL',50,'2026-11-10T15:01:00Z'),
    quote('3','3','IWM',200,'2026-11-10T15:02:00Z'),quote('4','1','KNOWN',110,'2026-11-11T15:01:00Z'),
    quote('5','2','CONTROL',45,'2026-11-11T15:01:00Z'),quote('6','3','IWM',202,'2026-11-11T15:02:00Z')];
  const report=auditResearchSignals(rows,news,quotes,[{companyId:'1',ticker:'KNOWN',cik:first.cik},{companyId:'2',ticker:'CONTROL',cik:second.cik}],'2026-11-11T22:00:00.000Z');
  expect(report.groups[0].rows).toBe(2);expect(report.groups[0].outcomes[0].rawPaired).toBe(2);expect(report.groups[0].outcomes[0].verifiedComparable).toBe(0);
  expect(report.rows[1].observationRole).toBe('signal'); // alphabetical CONTROL precedes KNOWN
  expect(report.rows.find(r=>r.ticker==='CONTROL')!.observationRole).toBe('excluded_control');
  expect(report.groups[0].outcomes[1].pending).toBe(2);
 });
 it('rejects same-signal, stale, future-captured and wrong-currency entries',()=>{
  const m=researchMember(),rows=evaluateResearchProtocol(researchInput(),news);
  const attempts=[quote('1','1','KNOWN',10,frozenAt),{...quote('2','1','KNOWN',10,'2026-11-10T15:01:00Z'),capturedAt:'2026-11-10T16:00:00Z'},
   {...quote('3','1','KNOWN',10,'2026-11-10T15:01:00Z'),capturedAt:'2026-11-12T15:01:00Z'},
   {...quote('4','1','KNOWN',10,'2026-11-10T15:01:00Z'),currency:'EUR'}];
  const r=auditResearchSignals(rows,news,attempts,[{companyId:'1',ticker:'KNOWN',cik:m.cik}],'2026-11-11T22:00:00.000Z');
  expect(r.rows[0].entry).toBeNull();expect(r.groups[0].outcomes[0].rawPaired).toBe(0);
 });
 it('does not use a later quote as the missing target-session winner, and preserves benchmark gaps',()=>{
  const m=researchMember(),rows=evaluateResearchProtocol(researchInput(),news);
  const entry=quote('1','1','KNOWN',100,'2026-11-10T15:01:00Z');
  const later=quote('2','1','KNOWN',200,'2026-11-12T15:01:00Z');
  const r=auditResearchSignals(rows,news,[entry,later],[{companyId:'1',ticker:'KNOWN',cik:m.cik}],'2026-11-12T22:00:00.000Z');
  expect(r.rows[0].outcomes[0].status).toBe('unavailable');expect(r.rows[0].outcomes[0].rawReturnPercent).toBeNull();
  expect(r.rows[0].outcomes[0].reasons).toContain('benchmark_entry_unavailable');
 });
});
