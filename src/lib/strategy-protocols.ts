import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const fundamental: typeof import('../../research/protocols/fundamental_growth_v1.json') = require('../../research/protocols/fundamental_growth_v1.json');
const news: typeof import('../../research/protocols/dated_news_event_v1.json') = require('../../research/protocols/dated_news_event_v1.json');
const schema: typeof import('../../research/protocols/schema.json') = require('../../research/protocols/schema.json');
import { isExpectedNewYorkRegularSession, newYorkPriceDate } from './price-observation';
export const RESEARCH_PROTOCOLS = [fundamental,news];
export type ResearchProtocol = typeof fundamental;
export function canonicalJSON(value:unknown):string {
  if (value===null || typeof value!=='object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonicalJSON).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON((value as Record<string,unknown>)[k])).join(',')+'}';
}
export function evidenceHash(value:unknown) { return createHash('sha256').update(canonicalJSON(value)).digest('hex'); }
export function engineManifest() {
  return Object.fromEntries(['strategy-protocols.ts','strategy-signal-evaluation.ts','strategy-snapshots.ts','strategy-outcome-audit.ts','growth-opportunities.ts','price-observation.ts']
    .map(file=>[file,createHash('sha256').update(readFileSync(join(process.cwd(),'src/lib',file),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
}
export function protocolHash(definition:ResearchProtocol,manifest=engineManifest()) {return evidenceHash({definition,engineManifest:manifest});}
export function validateProtocol(value:ResearchProtocol) {
  if(Object.keys(value).sort().join()!==Object.keys(schema.properties).sort().join()
    ||schema.required.some(k=>value[k]==null)||(!Number.isInteger(value.version)||value.version<1)||!['fundamental_growth_v1','dated_news_event_v1'].includes(value.id)
    ||value.scope!=='signal_study_only_no_orders'||!value.horizonsTradingDays.every(n=>Number.isInteger(n)&&n>0))throw Error('Invalid research protocol');
}
const DAY=86400000, cache=new Map<string,{open:string;close:string}|null>();
export function tradingSession(date:string) {
  if(cache.has(date))return cache.get(date)!;
  if(!/^202[6-8]-\d{2}-\d{2}$/.test(date))return null;
  const noon=new Date(date+'T12:00:00Z');
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(noon));
  const offset=12-hour, base=Date.parse(date+'T00:00:00Z');
  const open=new Date(base+(9.5+offset)*3600000).toISOString();
  const early=!isExpectedNewYorkRegularSession(new Date(base+(13+offset)*3600000));
  const result=isExpectedNewYorkRegularSession(open)?{open,close:new Date(base+((early?13:16)+offset)*3600000).toISOString()}:null;
  cache.set(date,result);return result;
}
export function addTradingSessions(date:string,count:number):string|null {
  let current=Date.parse(date+'T00:00:00Z'), remaining=count;
  for(let i=0;i<500&&remaining>0;i++){current+=DAY;if(tradingSession(new Date(current).toISOString().slice(0,10)))remaining--;}
  return remaining===0?new Date(current).toISOString().slice(0,10):null;
}
export function referenceWindow(at:string) {
  const date=newYorkPriceDate(at);if(!date)return null;
  let day=date;
  for(let i=0;i<12;i++){
    const session=tradingSession(day);
    if(session&&Date.parse(at)<Date.parse(session.close)){
      const earliest=new Date(Math.max(Date.parse(at)+1,Date.parse(session.open))).toISOString();
      if(Date.parse(earliest)>=Date.parse(session.close)){day=new Date(Date.parse(day+'T00:00:00Z')+DAY).toISOString().slice(0,10);continue;}
      const last=addTradingSessions(day,2);return last?{earliest,deadline:tradingSession(last)!.close}:null;
    }
    day=new Date(Date.parse(day+'T00:00:00Z')+DAY).toISOString().slice(0,10);
  }return null;
}
