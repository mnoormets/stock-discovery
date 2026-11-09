export function xmlText(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, code, name) => {
    if (code) { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1),16) : Number(code); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[name.toLowerCase()];
  }).trim();
}
export function xmlField(block: string, tag: string): string {
  return xmlText(block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'))?.[1] ?? '');
}
export function webURL(value: string): string | null {
  try { const u = new URL(value); if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return null; u.hash=''; return u.toString(); } catch { return null; }
}
export function rssItems(text: string): string[] {
  if (text.length > 4*1024*1024 || !/<rss[\s>]/i.test(text)) throw new Error('Invalid or oversized RSS response');
  return [...text.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}
