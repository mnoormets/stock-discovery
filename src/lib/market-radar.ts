import YahooFinance from 'yahoo-finance2';
import { pool, resolveCollectionCompanyIds } from './db';
import { quoteMarketTime } from './yahoo';
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
type Channel = typeof MARKET_RADAR_CHANNELS[number]['id'];
export interface MarketRadarStock {
  ticker: string; name: string; price: number | null; changePercent: number | null;
  marketAt: string | null; marketCap: number | null; volume: number | null;
  relativeVolume: number | null; channels: Channel[]; warnings: string[];
}
export interface MarketRadarSnapshot {
  version: typeof MARKET_RADAR_VERSION; observedAt: string;
  channels: Array<{ id: Channel; status: 'ok' | 'failed'; received: number; accepted: number }>;
  stocks: MarketRadarStock[];
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
  fetchChannel: (channel: Channel) => Promise<unknown> = (channel) => yahoo.screener(
    { scrIds: channel, count: MARKET_RADAR_CHANNEL_LIMIT }, undefined,
    { validateResult: false, fetchOptions: { signal: AbortSignal.timeout(15000) } },
  ),
): Promise<MarketRadarSnapshot> {
  const stocks = new Map<string, MarketRadarStock>();
  const channels: MarketRadarSnapshot['channels'] = [];
  for (const channel of MARKET_RADAR_CHANNELS) {
    try {
      const response = await fetchChannel(channel.id);
      const rows = normalizeMarketRadarRows(response, channel.id, now);
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

export async function collectMarketRadar(): Promise<MarketRadarSnapshot> {
  const snapshot = await fetchMarketRadar();
  await persistMarketRadarCompanies(snapshot);
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
}> {
  // Latest collection only: never hide a failed/missing refresh behind an old success.
  const result = await pool.query(`SELECT metrics->'marketRadar' AS radar, started_at
    FROM collection_runs ORDER BY id DESC LIMIT 1`);
  const snapshot = result.rows[0]?.radar as MarketRadarSnapshot | null;
  if (!snapshot || snapshot.version !== MARKET_RADAR_VERSION || !Array.isArray(snapshot.stocks)) {
    return { snapshot: null, facts: {}, runAt: result.rows[0]?.started_at?.toISOString() ?? null };
  }
  const coverage = await pool.query(`SELECT c.ticker, count(f.id)::int AS facts FROM companies c
    LEFT JOIN financial_facts f ON f.company_id=c.id WHERE c.ticker=ANY($1::text[]) GROUP BY c.ticker`,
  [snapshot.stocks.map((s) => s.ticker)]);
  return { snapshot, facts: Object.fromEntries(coverage.rows.map((r) => [r.ticker, r.facts])), runAt: result.rows[0].started_at.toISOString() };
}
