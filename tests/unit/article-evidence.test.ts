import { describe,expect,it } from 'vitest';
import { createHash } from 'node:crypto';
import { analyseArticle, collectArticleEvidence, extractArticle, ARTICLE_LIMIT } from '../../src/lib/article-evidence';
import { ArticleAccessError, articleURL, publicArticleAddress, readPublicArticle } from '../../src/lib/article-reader';
const now=new Date('2026-11-10T18:00:00Z');
const body='<p>Acme Therapeutics reported revenue of $120 million, below consensus estimates of $150 million.</p><p>The company expects revenue of $180 million next year, subject to successful clinical trials.</p><p>An analyst believes the shares could outperform because of an unconfirmed contract rumor.</p><p>Management said the cash balance provides liquidity for its ongoing research programs and announced a new share offering.</p>';
const html='<html><head><title>Acme results</title><meta property="article:published_time" content="2026-11-09T16:00:00Z"><meta property="article:modified_time" content="2026-11-10T17:00:00Z"></head><body><nav>Unrelated navigation</nav><article><h1>Acme results</h1>'+body+'</article><script>globalThis.stolen=true</script></body></html>';
function item(n:number){return {id:String(n),url:'https://publisher.test/'+n,title:'ACME earnings',publisher:'publisher.test',publishedAt:'2026-11-09T16:00:00Z',observedAt:now.toISOString(),query:'earnings',tickers:['ACME']};}
describe('public article content evidence',()=>{
 it('reads body-only adverse evidence, keeps publication/update separate and never executes scripts',()=>{
  const r=extractArticle(html,'https://publisher.test/a',now);
  expect(r.text).toContain('below consensus');expect(r.text).not.toContain('Unrelated navigation');
  expect(r.publishedAt).toBe('2026-11-09T16:00:00.000Z');expect(r.modifiedAt).toBe('2026-11-10T17:00:00.000Z');
  expect(r.claims.find(c=>c.topic==='earnings')?.expectation).toBe('reported_miss');
  expect(r.claims.some(c=>c.role==='forward_looking')).toBe(true);expect((globalThis as any).stolen).toBeUndefined();
 });
 it('does not invent surprise from growth, negation, analyst opinion or rumor',()=>{
  for(const s of ['Revenue increased 20% from last year without any published consensus estimate.',
    'Revenue did not beat consensus estimates of $20 million.',
    'An analyst believes revenue beat consensus estimates of $20 million.',
    'Reportedly revenue beat consensus estimates of $20 million.'])
    expect(analyseArticle(s)[0].expectation).toBe('not_established');
  expect(analyseArticle('Revenue beat consensus estimates of $20 million.')[0].expectation).toBe('reported_beat');
 });
 it('respects paywall/challenge metadata, refuses tiny or oversized pages and never uses future dates',()=>{
  expect(()=>extractArticle(html.replace('<head>','<head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>'),'https://publisher.test',now)).toThrow('paywall');
  expect(()=>extractArticle('<html><body>Verify you are human</body></html>','https://publisher.test',now)).toThrow('access_challenge');
  expect(()=>extractArticle('<p>ACME earnings</p>','https://publisher.test',now)).toThrow('no_readable_article');
  expect(()=>extractArticle('x'.repeat(2*1024*1024+1),'https://publisher.test',now)).toThrow('response_too_large');
  expect(extractArticle(html.replace('2026-11-09T16:00:00Z','2027-11-09T16:00:00Z'),'https://publisher.test',now).publishedAt).toBeNull();
 });
 it('caps requests, caches content point-in-time, detects exact copies and sanitizes errors',async()=>{
  const web=Array.from({length:13},(_,n)=>item(n));let calls=0;
  const read=async(url:string)=>{calls++;if(url.endsWith('/2'))throw new Error('secret backend detail');return {url,html};};
  const first=await collectArticleEvidence(web,undefined,now,read);
  expect(calls).toBe(ARTICLE_LIMIT);expect(first.deferred).toBe(3);expect(first.articles.filter(a=>a.duplicateOf).length).toBe(8);
  expect(JSON.stringify(first)).not.toContain('secret backend');const one=first.articles.find(a=>a.id==='0')!;
  expect(one.sha256).toBe(createHash('sha256').update(one.text!).digest('hex'));
  const later=new Date(now.getTime()+60000);const next=await collectArticleEvidence(web,first,later,read,async()=>later);
  expect(calls).toBe(13);expect(next.deferred).toBe(0);expect(next.articles.find(a=>a.id==='0')?.fetchedAt).toBe(one.fetchedAt);
  const replay=await collectArticleEvidence(web,next,later,read);expect(calls).toBe(13);expect(replay.attempted).toBe(0);
 });
 it('records actual receipt time and reports access refusals without private diagnostics',async()=>{
  const receipt=new Date(now.getTime()+10000);
  const result=await collectArticleEvidence([item(1)],undefined,now,async()=>({url:'https://publisher.test/1',html}),async()=>receipt);
  expect(result.articles[0].fetchedAt).toBe(receipt.toISOString());
  const blocked=await collectArticleEvidence([item(1)],undefined,now,async()=>{throw new ArticleAccessError('robots_blocked_or_unavailable');});
  expect(blocked.articles[0].status).toBe('blocked');
 });
 it('prioritizes direct publisher pages over aggregator wrappers in the bounded queue',async()=>{
  const wrapper={...item(0),url:'https://news.google.com/rss/articles/a'};
  const direct={...item(1),observedAt:'2026-11-10T18:01:00Z'};
  const seen:string[]=[];
  await collectArticleEvidence([wrapper,direct],undefined,now,async(url)=>{seen.push(url);return{url,html};});
  expect(seen[0]).toBe(direct.url);
 });
 it('obeys robots and checks redirect destinations before requesting them',async()=>{
  const seen:string[]=[];
  const get=async(url:URL)=>{seen.push(url.href);return {status:200,text:url.pathname==='/robots.txt'?'User-agent: *\nDisallow: /private':'<article>body</article>',contentType:'text/html'};};
  await expect(readPublicArticle('https://publisher.test/private',get)).rejects.toThrow('robots_blocked');
  expect(seen).toEqual(['https://publisher.test/robots.txt']);
  seen.length=0;
  await expect(readPublicArticle('https://publisher.test/public',async(url:URL)=>{seen.push(url.href);return url.pathname==='/robots.txt'
    ?{status:404,text:'',contentType:'text/plain'}:{status:302,text:'',contentType:'text/html',location:'https://127.0.0.1/private'};})).rejects.toThrow('unsafe_url');
  expect(seen).toEqual(['https://publisher.test/robots.txt','https://publisher.test/public']);
 });
 it('blocks credentials, non-HTTPS, local, private and metadata network destinations',()=>{
  for(const url of ['http://example.com','https://user:password@example.com','https://localhost/a','https://127.0.0.1','https://example.com:8443'])expect(()=>articleURL(url)).toThrow();
  for(const ip of ['127.0.0.1','169.254.169.254','10.2.3.4','172.16.1.1','192.168.0.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1'])expect(publicArticleAddress(ip)).toBe(false);
  expect(publicArticleAddress('8.8.8.8')).toBe(true);
 });
});
