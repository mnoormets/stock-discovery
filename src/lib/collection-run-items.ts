import type { PoolClient } from 'pg';
import { pool } from './db';

export const COLLECTION_RUN_ITEM_VERSION = 'collection-run-item-v1';

export type CollectionLookupBucket = 'growth' | 'recall' | 'not_selected' | 'unknown';

export interface CollectionRunItemInput {
  collectionRunId: number;
  ticker: string;
  itemVersion?: string;
  firstSeenAt?: Date | string | null;
  lookupBucket: CollectionLookupBucket;
  selectedForMarketData: boolean;
  marketDataAttempted: boolean;
  marketDataFound: boolean;
  marketDataSource?: string | null;
  mentionCount?: number | null;
  previousMentionCount?: number | null;
  mentionGrowthPercent?: number | null;
  attentionRank?: number | null;
  growthRank?: number | null;
  recallRank?: number | null;
  companyId?: number | null;
  skipReason?: string | null;
  rawSignal?: Record<string, unknown>;
  warnings?: unknown[];
}

export interface CollectionRunItemRecord extends Required<Omit<CollectionRunItemInput,
  'firstSeenAt' | 'marketDataSource' | 'mentionCount' | 'previousMentionCount'
  | 'mentionGrowthPercent' | 'attentionRank' | 'growthRank' | 'recallRank'
  | 'companyId' | 'skipReason' | 'rawSignal' | 'warnings'>> {
  id: number;
  firstSeenAt: string | null;
  observedAt: string;
  marketDataSource: string | null;
  mentionCount: number | null;
  previousMentionCount: number | null;
  mentionGrowthPercent: number | null;
  attentionRank: number | null;
  growthRank: number | null;
  recallRank: number | null;
  companyId: number | null;
  skipReason: string | null;
  rawSignal: Record<string, unknown>;
  warnings: unknown[];
}

const BUCKETS = new Set<CollectionLookupBucket>(['growth', 'recall', 'not_selected', 'unknown']);

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function optionalInteger(value: number | null | undefined, field: string, minimum: number): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${field} väärtus ei ole lubatud.`);
  return value;
}

function optionalNumber(value: number | null | undefined, field: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) throw new Error(`${field} peab olema lõplik arv.`);
  return value;
}

function timestamp(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('firstSeenAt ei ole kehtiv aeg.');
  return date.toISOString();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function normalize(input: CollectionRunItemInput) {
  if (!Number.isInteger(input.collectionRunId) || input.collectionRunId <= 0) {
    throw new Error('collectionRunId peab olema positiivne täisarv.');
  }
  const ticker = input.ticker.trim().toUpperCase();
  if (!ticker) throw new Error('Collection run item ticker ei tohi olla tühi.');
  const itemVersion = (input.itemVersion || COLLECTION_RUN_ITEM_VERSION).trim();
  if (!itemVersion) throw new Error('Collection run item version ei tohi olla tühi.');
  if (!BUCKETS.has(input.lookupBucket)) throw new Error(`Tundmatu lookup bucket: ${input.lookupBucket}`);
  if (input.marketDataFound && !input.marketDataAttempted) {
    throw new Error('Leitud market data eeldab market-data katset.');
  }
  if (input.marketDataAttempted && !input.selectedForMarketData) {
    throw new Error('Market-data katse eeldab lookupiks valimist.');
  }
  if (input.lookupBucket === 'not_selected' && input.selectedForMarketData) {
    throw new Error('not_selected ticker ei saa olla market-data lookupiks valitud.');
  }
  const rawSignal = input.rawSignal ?? {};
  if (!rawSignal || typeof rawSignal !== 'object' || Array.isArray(rawSignal)) {
    throw new Error('rawSignal peab olema JSON objekt.');
  }
  const warnings = input.warnings ?? [];
  if (!Array.isArray(warnings)) throw new Error('warnings peab olema JSON massiiv.');
  return {
    collectionRunId: input.collectionRunId,
    ticker,
    itemVersion,
    firstSeenAt: timestamp(input.firstSeenAt),
    lookupBucket: input.lookupBucket,
    selectedForMarketData: Boolean(input.selectedForMarketData),
    marketDataAttempted: Boolean(input.marketDataAttempted),
    marketDataFound: Boolean(input.marketDataFound),
    marketDataSource: optionalText(input.marketDataSource),
    mentionCount: optionalInteger(input.mentionCount, 'mentionCount', 0),
    previousMentionCount: optionalInteger(input.previousMentionCount, 'previousMentionCount', 0),
    mentionGrowthPercent: optionalNumber(input.mentionGrowthPercent, 'mentionGrowthPercent'),
    attentionRank: optionalInteger(input.attentionRank, 'attentionRank', 1),
    growthRank: optionalInteger(input.growthRank, 'growthRank', 1),
    recallRank: optionalInteger(input.recallRank, 'recallRank', 1),
    companyId: optionalInteger(input.companyId, 'companyId', 1),
    skipReason: optionalText(input.skipReason),
    rawSignal: stableValue(rawSignal) as Record<string, unknown>,
    warnings: stableValue(warnings) as unknown[],
  };
}

function mapRow(row: any): CollectionRunItemRecord {
  return {
    id: Number(row.id),
    collectionRunId: Number(row.collection_run_id),
    ticker: String(row.ticker),
    itemVersion: String(row.item_version),
    firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at).toISOString() : null,
    observedAt: new Date(row.observed_at).toISOString(),
    lookupBucket: row.lookup_bucket,
    selectedForMarketData: Boolean(row.selected_for_market_data),
    marketDataAttempted: Boolean(row.market_data_attempted),
    marketDataFound: Boolean(row.market_data_found),
    marketDataSource: row.market_data_source || null,
    mentionCount: row.mention_count == null ? null : Number(row.mention_count),
    previousMentionCount: row.previous_mention_count == null ? null : Number(row.previous_mention_count),
    mentionGrowthPercent: row.mention_growth_percent == null ? null : Number(row.mention_growth_percent),
    attentionRank: row.attention_rank == null ? null : Number(row.attention_rank),
    growthRank: row.growth_rank == null ? null : Number(row.growth_rank),
    recallRank: row.recall_rank == null ? null : Number(row.recall_rank),
    companyId: row.company_id == null ? null : Number(row.company_id),
    skipReason: row.skip_reason || null,
    rawSignal: row.raw_signal && typeof row.raw_signal === 'object' && !Array.isArray(row.raw_signal)
      ? row.raw_signal : {},
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
  };
}

function terminalValue(item: ReturnType<typeof normalize> | CollectionRunItemRecord): unknown {
  const { collectionRunId, ticker, itemVersion, firstSeenAt, lookupBucket,
    selectedForMarketData, marketDataAttempted, marketDataFound, marketDataSource,
    mentionCount, previousMentionCount, mentionGrowthPercent, attentionRank, growthRank,
    recallRank, companyId, skipReason, rawSignal, warnings } = item;
  return stableValue({ collectionRunId, ticker, itemVersion, firstSeenAt, lookupBucket,
    selectedForMarketData, marketDataAttempted, marketDataFound, marketDataSource,
    mentionCount, previousMentionCount, mentionGrowthPercent, attentionRank, growthRank,
    recallRank, companyId, skipReason, rawSignal, warnings });
}

async function insertOne(client: PoolClient, input: CollectionRunItemInput): Promise<CollectionRunItemRecord> {
  const item = normalize(input);
  const params = [item.collectionRunId, item.ticker, item.itemVersion, item.firstSeenAt,
    item.lookupBucket, item.selectedForMarketData, item.marketDataAttempted, item.marketDataFound,
    item.marketDataSource, item.mentionCount, item.previousMentionCount, item.mentionGrowthPercent,
    item.attentionRank, item.growthRank, item.recallRank, item.companyId, item.skipReason,
    JSON.stringify(item.rawSignal), JSON.stringify(item.warnings)];
  const inserted = await client.query(
    `INSERT INTO collection_run_items
      (collection_run_id, ticker, item_version, first_seen_at, lookup_bucket,
       selected_for_market_data, market_data_attempted, market_data_found,
       market_data_source, mention_count, previous_mention_count, mention_growth_percent,
       attention_rank, growth_rank, recall_rank, company_id, skip_reason, raw_signal, warnings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb)
     ON CONFLICT (collection_run_id, ticker) DO NOTHING
     RETURNING *`,
    params,
  );
  if (inserted.rows[0]) return mapRow(inserted.rows[0]);

  const existingResult = await client.query(
    `SELECT * FROM collection_run_items WHERE collection_run_id = $1 AND ticker = $2`,
    [item.collectionRunId, item.ticker],
  );
  const existing = mapRow(existingResult.rows[0]);
  if (JSON.stringify(terminalValue(existing)) === JSON.stringify(terminalValue(item))) return existing;
  throw new Error(
    `Collection run #${item.collectionRunId} ticker ${item.ticker} provenance on juba teistsuguse terminalinfoga salvestatud.`,
  );
}

export async function recordCollectionRunItem(input: CollectionRunItemInput): Promise<CollectionRunItemRecord> {
  const [record] = await recordCollectionRunItems([input]);
  return record;
}

export async function recordCollectionRunItems(inputs: CollectionRunItemInput[]): Promise<CollectionRunItemRecord[]> {
  if (inputs.length === 0) return [];
  const keys = new Set<string>();
  for (const input of inputs) {
    const normalized = normalize(input);
    const key = `${normalized.collectionRunId}:${normalized.ticker}`;
    if (keys.has(key)) throw new Error(`Collection run item batch sisaldab duplikaati: ${key}.`);
    keys.add(key);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const records: CollectionRunItemRecord[] = [];
    for (const input of inputs) records.push(await insertOne(client, input));
    await client.query('COMMIT');
    return records;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCollectionRunItems(collectionRunId: number): Promise<CollectionRunItemRecord[]> {
  if (!Number.isInteger(collectionRunId) || collectionRunId <= 0) return [];
  const { rows } = await pool.query(
    `SELECT * FROM collection_run_items
     WHERE collection_run_id = $1
     ORDER BY attention_rank NULLS LAST, ticker, id`,
    [collectionRunId],
  );
  return rows.map(mapRow);
}

// Growth is the primary selection path and wins deterministically if future
// selection logic ever places a ticker in both sets. Current selector makes the
// two sets disjoint, but keeping this rule explicit protects historical meaning.
export function resolveLookupBucket(
  ticker: string,
  growthTickers: ReadonlySet<string>,
  recallTickers: ReadonlySet<string>,
): CollectionLookupBucket {
  if (growthTickers.has(ticker)) return 'growth';
  if (recallTickers.has(ticker)) return 'recall';
  return 'not_selected';
}
