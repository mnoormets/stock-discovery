import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
// CommonJS export also works through the existing scheduled CLI loader.
const robotsParser: typeof import('robots-parser').default = require('robots-parser');

const AGENT = 'StockDiscoveryResearch';
const MAX_BYTES = 2 * 1024 * 1024;
export class ArticleAccessError extends Error {
  constructor(public reason: string) { super(reason); }
}
export function publicArticleAddress(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
  if (isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b))
    || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19].includes(b)));
}
export function articleURL(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !url.hostname.includes('.') || isIP(url.hostname.replace(/[\[\]]/g,''))) throw new ArticleAccessError('unsafe_url');
  url.hash = '';
  return url;
}
export type ArticlePage = { status: number; text: string; location?: string; contentType: string };
async function getPage(url: URL): Promise<ArticlePage> {
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(a => !publicArticleAddress(a.address))) throw new ArticleAccessError('unsafe_address');
  // Pin the validated DNS result to this connection, including redirects.
  return new Promise((resolve,reject) => {
    const req = request(url, { family: 4, headers: { 'User-Agent': AGENT + '/1.0', Accept: 'text/html,text/plain;q=0.8', 'Accept-Encoding': 'identity' },
      lookup: (_host,_options,callback) => callback(null,addresses[0].address,addresses[0].family),
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > MAX_BYTES) { req.destroy(new ArticleAccessError('response_too_large')); return; } chunks.push(Buffer.from(chunk)); });
      response.on('error',reject);
      response.on('end',() => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8'),
        location: response.headers.location, contentType: String(response.headers['content-type'] ?? '') }));
    });
    const timer=setTimeout(() => req.destroy(new ArticleAccessError('timeout')),8000);
    req.on('close',()=>clearTimeout(timer));
    req.on('error',reject); req.end();
  });
}
/** Public HTTPS only. No scripts, cookies, credentials, paywall/challenge bypass or browser rendering. */
export async function readPublicArticle(input: string, get: (url:URL)=>Promise<ArticlePage> = getPage): Promise<{url:string;html:string}> {
  let url = articleURL(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const robotsURL = new URL('/robots.txt',url);
    const robots = await get(robotsURL);
    if (robots.status !== 404 && (robots.status !== 200 || robotsParser(robotsURL.href,robots.text).isAllowed(url.href,AGENT) === false))
      throw new ArticleAccessError('robots_blocked_or_unavailable');
    const page = await get(url);
    if ([301,302,303,307,308].includes(page.status) && page.location) { url = articleURL(new URL(page.location,url).href); continue; }
    if (page.status !== 200) throw new ArticleAccessError('http_' + page.status);
    if (!page.contentType.toLowerCase().includes('text/html')) throw new ArticleAccessError('unsupported_content');
    return {url:url.href,html:page.text};
  }
  throw new ArticleAccessError('redirect_limit');
}
