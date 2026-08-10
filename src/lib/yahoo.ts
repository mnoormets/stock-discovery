import YahooFinance from 'yahoo-finance2';
import type { Fundamentals } from './types';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Yahoo Finance (yahoo-finance2 npm, võtmeta): hind + turukapitalisatsioon.
// Yahoo rate-limitib agressiivselt, seega: väikesed pakid + viivitus + kordus.
export async function fetchFundamentals(tickers: string[]): Promise<Map<string, Fundamentals>> {
  const map = new Map<string, Fundamentals>();
  if (tickers.length === 0) return map;

  const CHUNK = 8;                 // väiksem pakk = väiksem 429 risk
  const DELAY_BETWEEN = 1200;      // ms iga paki vahel
  const RETRY_WAITS = [2000, 5000]; // korduse ootused, kui pakk kukub (429)

  for (let i = 0; i < tickers.length; i += CHUNK) {
    const chunk = tickers.slice(i, i + CHUNK);

    let ok = false;
    for (let attempt = 0; attempt <= RETRY_WAITS.length && !ok; attempt++) {
      try {
        // yahoo-finance2 v3 tüübid ei järelda dünaamilise tickerite massiivi
        // tagastust korrektselt, seega normaliseerime selle siin teadlikult.
        const quotes: any = await yahooFinance.quote(chunk);
        const arr: any[] = Array.isArray(quotes) ? quotes : [quotes];
        for (const q of arr) {
          if (!q?.symbol) continue;
          const vol =
            (typeof q.averageDailyVolume3Month === 'number' && q.averageDailyVolume3Month) ||
            (typeof q.averageDailyVolume10Day === 'number' && q.averageDailyVolume10Day) ||
            (typeof q.regularMarketVolume === 'number' && q.regularMarketVolume) ||
            undefined;
          map.set(String(q.symbol).toUpperCase(), {
            ticker: String(q.symbol).toUpperCase(),
            name: q.longName || q.shortName || undefined,
            marketCap: typeof q.marketCap === 'number' ? q.marketCap : undefined,
            price: typeof q.regularMarketPrice === 'number' ? q.regularMarketPrice : undefined,
            currency: q.currency || undefined,
            volume: vol || undefined,
            // quoteType 'ETF'/'MUTUALFUND' → fond, filtreerime välja
            isFund: q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND',
            source: 'yahoo',
          });
        }
        ok = true;
      } catch (err) {
        const msg = (err as Error).message;
        if (attempt < RETRY_WAITS.length) {
          // Tõenäoliselt rate-limit — oota ja proovi uuesti.
          await sleep(RETRY_WAITS[attempt]);
        } else {
          console.warn(`Yahoo pakk ebaõnnestus (${chunk.join(',')}): ${msg}`);
        }
      }
    }

    // Ole APIga viisakas — väike paus enne järgmist pakki.
    if (i + CHUNK < tickers.length) await sleep(DELAY_BETWEEN);
  }

  return map;
}
