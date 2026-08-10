// SEC kauplemispeatamiste feed.
// TÄHTIS: feed sisaldab ainult ettevõtte NIME (nt "Happy City Holdings Limited"),
// MITTE tickerit. Seega sobitame kandidaadi NIME järgi (normaliseeritult).
// See on odav turvavõrk — SEC peatab enamasti hämaraid shell-firmasid, mille
// kattuvus WSB-tickeritega on harv, aga kui klapib → tugev hoiatus.

const FEED_URL = 'https://www.sec.gov/enforcement-litigation/trading-suspensions/rss';

export interface SecSuspension {
  company: string;    // originaalnimi feedist
  normalized: string; // normaliseeritud (sobitamiseks)
  pubDate: string;    // millal feedis avaldati
  link: string;       // PDF-i link
}

// Normaliseeri firmanimi sobitamiseks: väiketähed, eemalda juriidilised sufiksid.
// Sama funktsiooni kasutab discovery.ts kandidaadi nime peal → mõlemad võrreldavad.
export function normalizeCompanyName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[.,'"()\/\-]/g, ' ')
    .replace(
      /\b(inc|incorporated|corp|corporation|ltd|limited|llc|plc|co|company|companies|holdings?|group|the|common|stock|shares?|class|sa|ag|nv|se|spa|ab|oyj|asa)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

// Lihtne HTML-entiteetide dekooder (feedi tekstis on nt &amp;).
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Tõmba ja parsi SEC feed. Ilma XML-teegita — lihtne regex, sest struktuur on stabiilne.
export async function fetchSecSuspensions(): Promise<SecSuspension[]> {
  const res = await fetch(FEED_URL, {
    // SEC nõuab tuvastatavat User-Agenti kontaktiga, muidu blokeerib.
    headers: { 'User-Agent': 'stock-discovery research maverick.noormets@tlt.ee' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`SEC feed vastas ${res.status}`);
  const xml = await res.text();

  const items: SecSuspension[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim());
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
    if (!title) continue;
    const normalized = normalizeCompanyName(title);
    if (!normalized) continue;
    items.push({ company: title, normalized, pubDate, link });
  }
  return items;
}
