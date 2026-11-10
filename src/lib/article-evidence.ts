import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { ArticleAccessError, readPublicArticle } from './article-reader';
import type { WebObservation } from './discovery-evidence';

export const ARTICLE_VERSION = 'article-content-v1';
export const ARTICLE_LIMIT = 10;
const MAX_TEXT = 40000, DAY = 86400000;
export interface ArticleClaim {
  topic: 'earnings'|'guidance'|'contract'|'clinical'|'financing';
  role: 'reported_statement'|'opinion'|'rumor'|'forward_looking';
  sentence: string; numbers: string[]; expectation: 'reported_beat'|'reported_miss'|'not_established';
}
export interface ArticleEvidence {
  id: string; sourceURL: string; resolvedURL: string|null; title: string; tickers: string[];
  fetchedAt: string; publishedAt: string|null; modifiedAt: string|null;
  status: 'extracted'|'blocked'|'unavailable'; reason: string|null;
  text: string|null; textLength: number; truncated: boolean; sha256: string|null;
  duplicateOf: string|null; claims: ArticleClaim[];
}
export interface ArticleScan {
  version: typeof ARTICLE_VERSION; observedAt:string; candidateCount:number; attempted:number;
  cached:number; deferred:number; articles:ArticleEvidence[];
}
const clean = (s:string) => s.replace(/\s+/g,' ').trim();
export function analyseArticle(text:string):ArticleClaim[] {
  const topics: [ArticleClaim['topic'],RegExp][] = [
    ['guidance',/\b(guidance|outlook|forecast)\b/i],
    ['earnings',/\b(revenue|earnings|EPS|profit|cash flow|margin)\b/i],
    ['contract',/\b(contract|backlog|partnership|acquisition|merger)\b/i],
    ['clinical',/\b(FDA|phase [123]|trial|approval)\b/i],
    ['financing',/\b(dilution|offering|bankruptcy|liquidity|debt|shares outstanding)\b/i],
  ];
  // Treat extracted text as untrusted source statements, never as instructions or verified facts.
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  return sentences.flatMap(raw => {
    const sentence = clean(raw); const topic = topics.find(([,pattern]) => pattern.test(sentence))?.[0];
    if (!topic || sentence.length < 25 || sentence.length > 900) return [];
    const role = /\b(rumou?r|unconfirmed|reportedly|sources familiar)\b/i.test(sentence) ? 'rumor'
      : /\b(analyst|opinion|believe|we think|price target)\b/i.test(sentence) ? 'opinion'
      : /\b(expects?|plans?|anticipates?|could|may|will|projects?)\b/i.test(sentence) ? 'forward_looking' : 'reported_statement';
    const ambiguous = /\b(not|never|no|without)\b/i.test(sentence) || role !== 'reported_statement';
    const expectation = ambiguous ? 'not_established'
      : /\b(beat|exceeded|above)\b.{0,55}\b(consensus|estimates|expectations)\b/i.test(sentence) ? 'reported_beat'
      : /\b(missed|below|fell short)\b.{0,55}\b(consensus|estimates|expectations)\b/i.test(sentence) ? 'reported_miss' : 'not_established';
    const numbers = sentence.match(/(?:USD\s*|\$)?-?\d[\d,]*(?:\.\d+)?(?:\s*(?:billion|million|thousand|percent|bps)|%|\s*bn\b)?/gi) ?? [];
    return [{topic,role,sentence,numbers:numbers.slice(0,12),expectation} as ArticleClaim];
  }).slice(0,12);
}
function metadataDate(value:string|null,now:Date):string|null {
  if (!value || !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const stamp = Date.parse(value); return Number.isFinite(stamp) && stamp <= now.getTime() ? new Date(stamp).toISOString() : null;
}
export function extractArticle(html:string,url:string,now:Date) {
  if (Buffer.byteLength(html,'utf8') > 2*1024*1024) throw new ArticleAccessError('response_too_large');
  // No runScripts/resources options: document scripts and remote subresources never execute.
  const dom = new JSDOM(html,{url}); const doc = dom.window.document;
  try {
    const schemas:Record<string,unknown>[] = [];
    const visit = (v:unknown) => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(visit); return; }
      const row=v as Record<string,unknown>; schemas.push(row); if(row['@graph'])visit(row['@graph']); };
    for(const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
      try { visit(JSON.parse(script.textContent ?? '')); } catch { /* Invalid metadata does not establish content or dates. */ }
    }
    if (schemas.some(s => s.isAccessibleForFree === false || s.isAccessibleForFree === 'False' || s.isAccessibleForFree === 'false'))
      throw new ArticleAccessError('paywall');
    for (const node of Array.from(doc.querySelectorAll('script,style'))) node.remove();
    if (/captcha|verify you are human|enable javascript and cookies|subscribe to continue reading|sign in to continue reading/i.test(doc.body?.textContent ?? ''))
      throw new ArticleAccessError('access_challenge_or_paywall');
    const schema = schemas.find(s => /Article|NewsArticle|ReportageNewsArticle/i.test(String(s['@type']))) ?? {};
    const meta = (name:string) => doc.querySelector('meta[property="'+name+'"],meta[name="'+name+'"]')?.getAttribute('content') ?? null;
    const publishedAt = metadataDate(meta('article:published_time') ?? String(schema.datePublished ?? ''),now);
    const modifiedAt = metadataDate(meta('article:modified_time') ?? String(schema.dateModified ?? ''),now);
    for (const node of Array.from(doc.querySelectorAll('p,li,td,th,h1,h2,h3'))) node.appendChild(doc.createTextNode(' '));
    const extracted = new Readability(doc,{charThreshold:250,maxElemsToParse:20000}).parse();
    const full = clean(extracted?.textContent ?? '');
    if (full.length < 300) throw new ArticleAccessError('no_readable_article');
    const text=full.slice(0,MAX_TEXT);
    return {title:clean(extracted?.title ?? ''),publishedAt,modifiedAt,text,textLength:full.length,truncated:full.length>MAX_TEXT,
      sha256:createHash('sha256').update(full).digest('hex'),claims:analyseArticle(text)};
  } finally { dom.window.close(); }
}
export async function collectArticleEvidence(web:WebObservation[],previous:ArticleScan|undefined,now:Date,
  read:typeof readPublicArticle=readPublicArticle,clock:()=>Promise<Date>=async()=>now):Promise<ArticleScan> {
  const ids=new Set(web.map(w=>w.id));
  const retained=(previous?.version===ARTICLE_VERSION?previous.articles:[]).filter(a=>ids.has(a.id)
    && Date.parse(a.fetchedAt)<=now.getTime() && Date.parse(a.fetchedAt)>=now.getTime()-7*DAY);
  const old=new Map(retained.map(a=>[a.id,a]));
  // Successful text is frozen; failed access gets at most one retry per day, without crowding out untouched URLs.
  const pending=web.filter(w=>!old.has(w.id)||(old.get(w.id)!.status!=='extracted'&&Date.parse(old.get(w.id)!.fetchedAt)<=now.getTime()-DAY))
    .sort((a,b)=>Number(old.has(a.id))-Number(old.has(b.id))||Number(new URL(a.url).hostname==='news.google.com')-Number(new URL(b.url).hostname==='news.google.com')
      ||Number(!!b.tickers.length)-Number(!!a.tickers.length)
      ||a.observedAt.localeCompare(b.observedAt)||a.id.localeCompare(b.id));
  const articles=new Map(retained.map(a=>[a.id,a])); let attempted=0;
  for(const item of pending.slice(0,ARTICLE_LIMIT)) {
    attempted++;
    const record:ArticleEvidence={id:item.id,sourceURL:item.url,resolvedURL:null,title:item.title,tickers:item.tickers,
      fetchedAt:now.toISOString(),publishedAt:null,modifiedAt:null,status:'unavailable',reason:null,
      text:null,textLength:0,truncated:false,sha256:null,duplicateOf:null,claims:[]};
    try {
      const page=await read(item.url); const received=await clock(); record.fetchedAt=received.toISOString(); record.resolvedURL=page.url;
      Object.assign(record,extractArticle(page.html,page.url,received),{status:'extracted'});
      const duplicate=[...articles.values()].find(a=>a.id!==record.id&&a.sha256===record.sha256&&a.status==='extracted');
      record.duplicateOf=duplicate?.duplicateOf??duplicate?.id??null;
    } catch(error) {
      record.fetchedAt=(await clock()).toISOString();
      record.reason=error instanceof ArticleAccessError?error.reason:'fetch_failed';
      record.status=['paywall','access_challenge_or_paywall','robots_blocked_or_unavailable','unsafe_url','unsafe_address'].includes(record.reason)?'blocked':'unavailable';
    }
    articles.set(item.id,record);
  }
  const kept=[...articles.values()].sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt)||a.id.localeCompare(b.id));
  // Retain status metadata for the whole search set so old URLs cannot starve unseen ones.
  let bodies=0; for(const a of kept) if(a.text && ++bodies>60) articles.set(a.id,{...a,text:null});
  return {version:ARTICLE_VERSION,observedAt:(await clock()).toISOString(),candidateCount:web.length,attempted,
    cached:retained.filter(a=>!pending.slice(0,ARTICLE_LIMIT).some(w=>w.id===a.id)).length,
    deferred:Math.max(0,pending.length-attempted),articles:kept.map(a=>articles.get(a.id)!)};
}
