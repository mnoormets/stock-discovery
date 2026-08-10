import type { Fundamentals } from './types';

// Financial Modeling Prep — Yahoo VARUVARIANT hinna/turukapi/mahu jaoks.
// Võti loetakse process.env.FMP_API_KEY-st (docker-compose → .env). MITTE kunagi koodi.
//
// NB: kasutaja algselt soovitud endpoint /stable/market-capitalization on FMP
// UUEL tasuta plaanil PREMIUM (HTTP 402). Samuti /stable/quote?symbol= ja v3/* (legacy).
// TÖÖTAV tasuta endpoint on /stable/profile?symbol=X — tagastab ÜHE kutsega
// turukapi + hinna + keskmise mahu + nime. Seega 1 kutse/ticker (250/päev limiit).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchFmpFundamentals(
  tickers: string[],
  apiKey: string,
): Promise<Map<string, Fundamentals>> {
  const map = new Map<string, Fundamentals>();
  if (!apiKey || tickers.length === 0) return map;

  const base = 'https://financialmodelingprep.com/stable';

  for (const t of tickers) {
    const sym = encodeURIComponent(t);
    try {
      const res = await fetch(`${base}/profile?symbol=${sym}&apikey=${apiKey}`, {
        headers: { 'User-Agent': 'stock-discovery/0.1' },
      });
      if (res.ok) {
        const json = await res.json();
        const row = Array.isArray(json) ? json[0] : json;
        if (row && (typeof row.marketCap === 'number' || typeof row.price === 'number')) {
          map.set(t, {
            ticker: t,
            name: row.companyName || undefined,
            marketCap: typeof row.marketCap === 'number' ? row.marketCap : undefined,
            price: typeof row.price === 'number' ? row.price : undefined,
            currency: row.currency || undefined,
            // keskmine maht on likviidsuse hindamiseks stabiilsem kui päevamaht
            volume:
              typeof row.averageVolume === 'number' ? row.averageVolume :
              typeof row.volume === 'number' ? row.volume : undefined,
            // FMP profile annab isEtf/isFund → nii püüame ka nimekirjast puuduvad ETF-id
            isFund: row.isEtf === true || row.isFund === true,
            source: 'fmp',
          });
        }
      }
    } catch (err) {
      // Ära logi võtit; ainult sõnum.
      console.warn(`FMP ${t} ebaõnnestus:`, (err as Error).message);
    }
    await sleep(120); // väike paus, et olla APIga viisakas
  }

  return map;
}
