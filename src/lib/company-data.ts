import yahooFinance from 'yahoo-finance2';
import type { CompanyResearch, NewsItem, SecFiling } from './investment';
import { normalizeTicker } from './investment';

(yahooFinance as any).suppressNotices?.(['yahooSurvey']);

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asFutureIso(...values: unknown[]): string | null {
  const dates = values
    .map(asIso)
    .filter((value): value is string => Boolean(value))
    .filter((value) => new Date(value).getTime() >= Date.now())
    .sort();
  return dates[0] || null;
}

async function fetchYahooNews(ticker: string): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=8`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'stock-discovery/1.0' },
    next: { revalidate: 900 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data?.news) ? data.news : [])
    .filter((item: any) => item?.title && item?.link)
    .map((item: any) => ({
      id: String(item.uuid || item.link),
      title: String(item.title),
      publisher: item.publisher ? String(item.publisher) : null,
      url: String(item.link),
      publishedAt: item.providerPublishTime
        ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
        : null,
    }));
}

let secTickerCache: { expires: number; rows: any[] } | null = null;

async function fetchSecFilings(ticker: string): Promise<SecFiling[]> {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return [];

  if (!secTickerCache || secTickerCache.expires < Date.now()) {
    const mappingRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': userAgent },
      next: { revalidate: 86400 },
    });
    if (!mappingRes.ok) return [];
    const mapping = await mappingRes.json();
    secTickerCache = { expires: Date.now() + 86_400_000, rows: Object.values(mapping) };
  }

  const match = secTickerCache.rows.find((row) => String(row.ticker).toUpperCase() === ticker);
  if (!match) return [];
  const cik = String(match.cik_str).padStart(10, '0');
  const submissionsRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { 'User-Agent': userAgent },
    next: { revalidate: 3600 },
  });
  if (!submissionsRes.ok) return [];
  const submissions = await submissionsRes.json();
  const recent = submissions?.filings?.recent;
  if (!recent?.accessionNumber) return [];

  return recent.accessionNumber.slice(0, 8).map((accession: string, index: number) => {
    const compactAccession = accession.replace(/-/g, '');
    const primaryDocument = recent.primaryDocument?.[index] || '';
    return {
      id: accession,
      form: String(recent.form?.[index] || 'SEC filing'),
      filedAt: String(recent.filingDate?.[index] || ''),
      description: recent.primaryDocDescription?.[index]
        ? String(recent.primaryDocDescription[index])
        : null,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(match.cik_str)}/${compactAccession}/${primaryDocument}`,
    };
  });
}

export async function fetchCompanyResearch(rawTicker: string): Promise<CompanyResearch | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;

  try {
    const quote: any = await yahooFinance.quote(ticker);
    if (!quote?.symbol || String(quote.symbol).toUpperCase() !== ticker) return null;

    const warnings: string[] = [];
    const [newsResult, secResult] = await Promise.allSettled([
      fetchYahooNews(ticker),
      fetchSecFilings(ticker),
    ]);
    const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
    const secFilings = secResult.status === 'fulfilled' ? secResult.value : [];
    if (newsResult.status === 'rejected') warnings.push('Uudiste allikas ei vastanud.');
    if (!process.env.SEC_USER_AGENT) warnings.push('SEC andmed pole seadistatud.');
    else if (secResult.status === 'rejected') warnings.push('SEC andmete allikas ei vastanud.');

    return {
      quote: {
        ticker,
        name: quote.longName || quote.shortName || null,
        exchange: quote.fullExchangeName || quote.exchange || null,
        quoteType: quote.quoteType || null,
        price: asNumber(quote.regularMarketPrice),
        previousClose: asNumber(quote.regularMarketPreviousClose),
        marketCap: asNumber(quote.marketCap),
        volume: asNumber(quote.regularMarketVolume),
        currency: quote.currency || null,
        earningsAt: asFutureIso(
          quote.earningsTimestamp,
          quote.earningsTimestampStart,
          quote.earningsTimestampEnd,
        ),
      },
      news,
      secFilings,
      warnings,
    };
  } catch {
    return null;
  }
}
