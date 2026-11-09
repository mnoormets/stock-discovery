import { enrichStoredCompanyFinancials, type FinancialEnrichmentResult } from './company-financials';
import { collectGrowthOpportunities, type GrowthOpportunitySnapshot } from './growth-opportunities';
import { collectEarlyOpportunities, type EarlyOpportunitySnapshot } from './early-opportunities';
import YahooFinance from 'yahoo-finance2';
import { pool, resolveCollectionCompanyIds } from './db';
import { quoteMarketTime, fetchResearchMarketQuotes } from './yahoo';
import { priceObservationRecency } from './price-observation';
import type { Fundamentals } from './types';

export const MARKET_RADAR_VERSION = 'market-radar-v1';
export const MARKET_RADAR_CHANNELS = [
  { id: 'day_gainers', label: 'Price gainers' },
  { id: 'small_cap_gainers', label: 'Small-cap gainers' },
  { id: 'most_actives', label: 'Active trading' },
  { id: 'aggressive_small_caps', label: 'Small-cap growth' },
  { id: 'growth_technology_stocks', label: 'Technology growth' },
  { id: 'undervalued_growth_stocks', label: 'Growth at lower valuations' },
] as const;
export const MARKET_RADAR_CHANNEL_LIMIT = 25;
export const MARKET_FINANCIAL_ENRICHMENT_LIMIT = 20;
type Channel = typeof MARKET_RADAR_CHANNELS[number]['id'] | 'source_discovery';
export interface MarketRadarStock {
  ticker: string; name: string; price: number | null; changePercent: number | null;
  marketAt: string | null; marketCap: number | null; volume: number | null;
  relativeVolume: number | null; channels: Channel[]; warnings: string[];
}
export interface MarketRadarSnapshot {
  version: typeof MARKET_RADAR_VERSION; observedAt: string;
  channels: Array<{ id: Channel; status: 'ok' | 'failed'; received: number; accepted: number }>;
  stocks: MarketRadarStock[];
  sourceDiscovery?: { version:string; requested:string[]; accepted:number; cached?:number };
  financialEnrichment?: FinancialEnrichmentResult | null;
  financialEnrichmentError?: string | null;
  early?: EarlyOpportunitySnapshot;
  growth?: GrowthOpportunitySnapshot;
}
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const positive = (v: unknown): number | null => { const n = number(v); return n != null && n > 0 ? n : null; };

// The installed client's screener schema rejects Yahoo's current canonicalName.
// Validate only the fields this feature consumes, including instrument and quote time.
export function normalizeMarketRadarRows(input: unknown, channel: Channel, now: Date): MarketRadarStock[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { quotes?: unknown }).quotes)) {
    throw new Error('Invalid Yahoo screener response');
  }
  const rows = (input as { quotes: unknown[] }).quotes.slice(0, MARKET_RADAR_CHANNEL_LIMIT);
  return rows.flatMap((row): MarketRadarStock[] => {
    if (!row || typeof row !== 'object') return [];
    const q = row as Record<string, unknown>;
    const ticker = typeof q.symbol === 'string' ? q.symbol.toUpperCase() : '';
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) || q.quoteType !== 'EQUITY' || q.currency !== 'USD'
      || !['NMS', 'NGM', 'NCM', 'NYQ', 'ASE'].includes(String(q.exchange))) return [];
    if (channel==='source_discovery' && /\bwarrants?\b|\brights\b|\bunits\b|\bunit[, ]+each\b|\bpreferred (stock|shares)\b/i.test(String(q.longName||q.shortName||''))) return [];
    const marketAt = quoteMarketTime(q.regularMarketTime);
    const fresh = marketAt != null && priceObservationRecency(marketAt, now.toISOString()) === 'recent';
    const price = fresh ? positive(q.regularMarketPrice) : null;
    const volume = positive(q.regularMarketVolume);
    const average = positive(q.averageDailyVolume3Month);
    return [{ ticker, name: String(q.longName || q.shortName || ticker), price,
      changePercent: price != null ? number(q.regularMarketChangePercent) : null,
      marketAt, marketCap: positive(q.marketCap), volume,
      relativeVolume: volume != null && average != null ? volume / average : null,
      channels: [channel], warnings: price == null ? ['Price missing, stale or timestamp invalid'] : [],
    }];
  });
}

export async function fetchMarketRadar(
  now = new Date(),
  fetchChannel: (channel: typeof MARKET_RADAR_CHANNELS[number]['id']) => Promise<unknown> = (channel) => yahoo.screener(
    { scrIds: channel, count: MARKET_RADAR_CHANNEL_LIMIT }, undefined,
    { validateResult: false, fetchOptions: { signal: AbortSignal.timeout(15000) } },
  ),
  clock: () => Promise<Date> = async () => now,
): Promise<MarketRadarSnapshot> {
  const stocks = new Map<string, MarketRadarStock>();
  const channels: MarketRadarSnapshot['channels'] = [];
  for (const channel of MARKET_RADAR_CHANNELS) {
    try {
      const response = await fetchChannel(channel.id);
      const rows = normalizeMarketRadarRows(response, channel.id, await clock());
      channels.push({ id: channel.id, status: 'ok', received: (response as { quotes: unknown[] }).quotes.length, accepted: rows.length });
      for (const row of rows) {
        const previous = stocks.get(row.ticker);
        if (previous) {
          const sources = [...new Set([...previous.channels, channel.id])];
          if (row.price != null && (previous.price == null || row.marketAt! > previous.marketAt!)) stocks.set(row.ticker, { ...row, channels: sources });
          else previous.channels = sources;
        } else stocks.set(row.ticker, row);
      }
    } catch {
      channels.push({ id: channel.id, status: 'failed', received: 0, accepted: 0 });
    }
  }
  return { version: MARKET_RADAR_VERSION, observedAt: now.toISOString(), channels, stocks: [...stocks.values()] };
}

export async function collectMarketRadar(extraTickers: string[] = [], observedTickers: string[] = []): Promise<MarketRadarSnapshot> {
  // Use the ledger clock: a desktop clock ahead of PostgreSQL otherwise makes the scan look future-dated.
  const clock = async () => (await pool.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0].now;
  const snapshot = await fetchMarketRadar(await clock(), undefined, clock);
  let cached=0;
  if (observedTickers.length) {
    const at=await clock();
    const stored=(await pool.query(`WITH classified AS (
      SELECT DISTINCT ON(x->>'ticker') x FROM collection_runs r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'stocks','[]'::jsonb)) x
      WHERE r.status='success' AND r.finished_at<=$2 AND r.finished_at>=$2::timestamptz-interval '30 days'
        AND r.metrics->'marketRadar'->>'version'='market-radar-v1' AND x->>'ticker'=ANY($1::text[])
      ORDER BY x->>'ticker',r.finished_at DESC,r.id DESC
    ) SELECT c.ticker,classified.x,p.price,p.market_at,p.volume,p.market_cap FROM classified JOIN companies c ON c.ticker=x->>'ticker'
      JOIN LATERAL (SELECT price,market_at,volume,market_cap FROM price_snapshots p WHERE p.company_id=c.id AND p.currency='USD'
        AND p.price>0 AND p.market_at<=p.captured_at AND p.captured_at<=$2 ORDER BY p.market_at DESC,p.captured_at DESC LIMIT 1)p ON true`,[observedTickers,at.toISOString()])).rows;
    const names=new Set(snapshot.stocks.map(s=>s.ticker));
    for(const r of stored)if(!names.has(r.ticker)&&priceObservationRecency(r.market_at?.toISOString(),at.toISOString())==='recent') {
      snapshot.stocks.push({...r.x,price:Number(r.price),marketAt:r.market_at.toISOString(),marketCap:r.market_cap==null?null:Number(r.market_cap),
        volume:r.volume==null?null:Number(r.volume),relativeVolume:null,changePercent:null,channels:['source_discovery'],warnings:['Cached research quote; live entry needs a strictly later fresh quote.']});cached++;
    }
  }
  if (extraTickers.length) {
    const requested = [...new Set(extraTickers)].slice(0,10);
    try {
      const response = await fetchResearchMarketQuotes(requested);
      const extras = normalizeMarketRadarRows(response, 'source_discovery', await clock());
      const stocks = new Map(snapshot.stocks.map(s => [s.ticker,s]));
      for (const extra of extras) { const old=stocks.get(extra.ticker); if (!old) stocks.set(extra.ticker,extra);
        else if(extra.price!=null && (old.price==null || extra.marketAt!>old.marketAt!)) stocks.set(extra.ticker,{...extra,channels:[...new Set([...old.channels,'source_discovery' as const])]});
        else old.channels=[...new Set([...old.channels,'source_discovery' as const])]; }
      snapshot.stocks=[...stocks.values()]; snapshot.channels.push({id:'source_discovery',status:'ok',received:requested.length,accepted:extras.length});
      snapshot.sourceDiscovery={version:'source-discovery-quote-v1',requested,accepted:extras.length,cached};
    } catch { snapshot.channels.push({id:'source_discovery',status:'failed',received:requested.length,accepted:0}); snapshot.sourceDiscovery={version:'source-discovery-quote-v1',requested,accepted:0,cached}; }
  }
  if(cached&&!snapshot.sourceDiscovery)snapshot.sourceDiscovery={version:'source-discovery-quote-v1',requested:[],accepted:0,cached};
  await persistMarketRadarCompanies(snapshot);
  snapshot.financialEnrichment = null;
  snapshot.financialEnrichmentError = null;
  try {
    snapshot.financialEnrichment = await enrichStoredCompanyFinancials(MARKET_FINANCIAL_ENRICHMENT_LIMIT);
  } catch {
    snapshot.financialEnrichmentError = 'SEC CompanyFacts enrichment unavailable; scan uses existing stored facts.';
  }
  const now = await clock();
  snapshot.early = await collectEarlyOpportunities(snapshot, now);
  snapshot.growth = await collectGrowthOpportunities(snapshot, now);
  const evaluatedAt = (await clock()).toISOString();
  snapshot.early.evaluatedAt = evaluatedAt;
  snapshot.growth.evaluatedAt = evaluatedAt;
  if (snapshot.growth.priceMomentum) snapshot.growth.priceMomentum.evaluatedAt = evaluatedAt;
  return snapshot;
}

export async function persistMarketRadarCompanies(snapshot: MarketRadarSnapshot): Promise<void> {
  const fundamentals = new Map<string, Fundamentals>();
  for (const stock of snapshot.stocks) {
    if (stock.price == null) continue;
    fundamentals.set(stock.ticker, { ticker: stock.ticker, name: stock.name, price: stock.price,
      marketAt: stock.marketAt, currency: 'USD', marketCap: stock.marketCap ?? undefined,
      volume: stock.volume ?? undefined, source: 'yahoo', isFund: false });
  }
  await resolveCollectionCompanyIds(fundamentals.keys(), fundamentals);
}

export async function getMarketRadar(): Promise<{
  snapshot: MarketRadarSnapshot | null; facts: Record<string, number>; runAt: string | null;
  firstSeen: Record<string, { at: string; price: number | null }>;
}> {
  // Latest collection only: never hide a failed/missing refresh behind an old success.
  const result = await pool.query(`SELECT metrics->'marketRadar' AS radar, started_at
    FROM collection_runs ORDER BY id DESC LIMIT 1`);
  const snapshot = result.rows[0]?.radar as MarketRadarSnapshot | null;
  if (!snapshot || snapshot.version !== MARKET_RADAR_VERSION || !Array.isArray(snapshot.stocks)) {
    return { snapshot: null, facts: {}, firstSeen: {}, runAt: result.rows[0]?.started_at?.toISOString() ?? null };
  }
  const coverage = await pool.query(`SELECT c.ticker, count(f.id)::int AS facts FROM companies c
    LEFT JOIN financial_facts f ON f.company_id=c.id WHERE c.ticker=ANY($1::text[]) GROUP BY c.ticker`,
  [snapshot.stocks.map((s) => s.ticker)]);
  const history = await pool.query(`SELECT DISTINCT ON (item->>'ticker') item->>'ticker' AS ticker,
    r.finished_at AS at, item->>'price' AS price FROM collection_runs r CROSS JOIN LATERAL
    jsonb_array_elements(COALESCE(r.metrics->'marketRadar'->'stocks','[]'::jsonb)) item
    WHERE r.status='success' AND r.finished_at <= clock_timestamp()
      AND r.metrics->'marketRadar'->>'version'=$2 AND item->>'ticker'=ANY($1::text[])
    ORDER BY item->>'ticker',r.finished_at,r.id`, [snapshot.stocks.map(s=>s.ticker), MARKET_RADAR_VERSION]);
  const firstSeen = Object.fromEntries(history.rows.map(r=>[r.ticker,{ at:r.at.toISOString(),
    price:r.price != null && Number.isFinite(Number(r.price)) && Number(r.price)>0 ? Number(r.price) : null }]));
  return { snapshot, firstSeen, facts: Object.fromEntries(coverage.rows.map((r) => [r.ticker, r.facts])), runAt: result.rows[0].started_at.toISOString() };
}
