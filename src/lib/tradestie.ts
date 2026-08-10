import type { TradestieRow } from './types';

// Tradestie WSB API: tasuta, ilma võtmeta.
// Annab WSB top ~50 tickeri sentimendi (Bullish/Bearish) + skoori.
// PIIRANG: katab ainult top 50 (peamiselt suured nimed), seega paljudel
// meie väikestel leidudel see puudub — sel juhul kasutame ApeWisdomi varusentimenti.
// Tagastame Map'i kiireks otsinguks ticker -> rida.
export async function fetchTradestie(): Promise<Map<string, TradestieRow>> {
  const url = 'https://api.tradestie.com/v1/apps/reddit';
  const res = await fetch(url, { headers: { 'User-Agent': 'stock-discovery/0.1' } });
  if (!res.ok) {
    throw new Error(`Tradestie vastas ${res.status}`);
  }
  const data = await res.json();
  const map = new Map<string, TradestieRow>();
  if (Array.isArray(data)) {
    for (const r of data) {
      const ticker = String(r.ticker).toUpperCase().trim();
      map.set(ticker, {
        ticker,
        no_of_comments: Number(r.no_of_comments ?? 0),
        sentiment: String(r.sentiment ?? ''),
        sentiment_score: Number(r.sentiment_score ?? 0),
      });
    }
  }
  return map;
}
