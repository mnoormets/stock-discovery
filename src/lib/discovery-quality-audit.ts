import { pool } from './db';

export type DiscoveryQualityDimension = 'sector' | 'market_cap' | 'country' | 'exchange';
export type DiscoveryScoreKey = 'growth' | 'health' | 'coverage' | 'total';

export interface DiscoveryQualitySourceItem {
  itemId: number;
  runId: number;
  symbol: string;
  observedAt: string;
  sector: string | null;
  marketCap: number | null;
  country: string | null;
  exchange: string | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
  totalScore: number | null;
}

export interface DiscoveryQualityDistributionBucket {
  bucket: string;
  count: number;
  percentage: number;
}

export interface DiscoveryQualityDistribution {
  key: DiscoveryQualityDimension;
  title: string;
  available: boolean;
  unavailableReason: string | null;
  knownCount: number;
  missingCount: number;
  buckets: DiscoveryQualityDistributionBucket[];
}

export interface DiscoveryDuplicateAudit {
  symbol: string;
  appearanceCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface DiscoveryScoreDistribution {
  key: DiscoveryScoreKey;
  title: string;
  available: boolean;
  unavailableReason: string | null;
  availableCount: number;
  missingCount: number;
  above80Count: number;
  above80Percentage: number | null;
  buckets: DiscoveryQualityDistributionBucket[];
}

export interface DiscoveryQualityOverview {
  totalItems: number;
  distinctSymbols: number;
  collectionRuns: number;
  repeatedSymbols: number;
  oneTimeSymbols: number;
  knownSectorItems: number;
  knownMarketCapItems: number;
  knownCountryItems: number;
  knownExchangeItems: number;
}

export interface DiscoveryQualityConcentration {
  topSectorSharePct: number | null;
  topThreeSectorSharePct: number | null;
  topMarketCapBucketSharePct: number | null;
  topExchangeSharePct: number | null;
  repeatAppearanceSharePct: number;
}

export interface DiscoveryQualityAudit {
  generatedAt: string;
  sampleUnit: string;
  overview: DiscoveryQualityOverview;
  distributions: DiscoveryQualityDistribution[];
  duplicates: DiscoveryDuplicateAudit[];
  scores: DiscoveryScoreDistribution[];
  concentration: DiscoveryQualityConcentration;
  highlights: string[];
}

const SCORE_BUCKETS = ['0-20', '20-40', '40-60', '60-80', '80-100'] as const;
const MARKET_CAP_BUCKETS = ['nano', 'micro', 'small', 'mid', 'large', 'Unknown'] as const;

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentage(part: number, total: number): number {
  return total > 0 ? roundPercentage((part / total) * 100) : 0;
}

function knownText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function marketCapBucket(marketCap: number | null): string | null {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap < 0) return null;
  if (marketCap < 50_000_000) return 'nano';
  if (marketCap < 300_000_000) return 'micro';
  if (marketCap < 2_000_000_000) return 'small';
  if (marketCap < 10_000_000_000) return 'mid';
  return 'large';
}

export function discoveryScoreBucket(score: number | null): (typeof SCORE_BUCKETS)[number] | null {
  if (score == null || !Number.isFinite(score) || score < 0 || score > 100) return null;
  if (score < 20) return '0-20';
  if (score < 40) return '20-40';
  if (score < 60) return '40-60';
  if (score < 80) return '60-80';
  return '80-100';
}

function distribution(
  key: DiscoveryQualityDimension,
  title: string,
  items: DiscoveryQualitySourceItem[],
  valueOf: (item: DiscoveryQualitySourceItem) => string | null,
  available = true,
  unavailableReason: string | null = null,
  preferredOrder?: readonly string[],
): DiscoveryQualityDistribution {
  if (!available) {
    return { key, title, available: false, unavailableReason, knownCount: 0, missingCount: items.length, buckets: [] };
  }
  const counts = new Map<string, number>();
  let knownCount = 0;
  for (const item of items) {
    const value = valueOf(item) || 'Unknown';
    if (value !== 'Unknown') knownCount += 1;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const order = preferredOrder ? new Map(preferredOrder.map((bucket, index) => [bucket, index])) : null;
  const buckets = [...counts.entries()]
    .sort(([a, aCount], [b, bCount]) => order
      ? (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER)
      : bCount - aCount || a.localeCompare(b))
    .map(([bucket, count]) => ({ bucket, count, percentage: percentage(count, items.length) }));
  return { key, title, available: true, unavailableReason: null, knownCount, missingCount: items.length - knownCount, buckets };
}

function scoreDistribution(
  key: DiscoveryScoreKey,
  title: string,
  items: DiscoveryQualitySourceItem[],
  valueOf: (item: DiscoveryQualitySourceItem) => number | null,
  available = true,
  unavailableReason: string | null = null,
): DiscoveryScoreDistribution {
  if (!available) {
    return {
      key, title, available: false, unavailableReason,
      availableCount: 0, missingCount: items.length, above80Count: 0, above80Percentage: null, buckets: [],
    };
  }
  const values = items.map(valueOf).filter((value): value is number => discoveryScoreBucket(value) != null);
  const counts = new Map(SCORE_BUCKETS.map((bucket) => [bucket, 0]));
  for (const value of values) counts.set(discoveryScoreBucket(value)!, counts.get(discoveryScoreBucket(value)!)! + 1);
  const above80Count = values.filter((value) => value > 80).length;
  return {
    key,
    title,
    available: true,
    unavailableReason: null,
    availableCount: values.length,
    missingCount: items.length - values.length,
    above80Count,
    above80Percentage: values.length ? percentage(above80Count, values.length) : null,
    buckets: SCORE_BUCKETS.map((bucket) => ({
      bucket,
      count: counts.get(bucket)!,
      percentage: percentage(counts.get(bucket)!, values.length),
    })),
  };
}

function topKnown(distributionValue: DiscoveryQualityDistribution): DiscoveryQualityDistributionBucket | null {
  return [...distributionValue.buckets]
    .filter((bucket) => bucket.bucket !== 'Unknown')
    .sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket))[0] || null;
}

function topKnownShare(distributionValue: DiscoveryQualityDistribution): number | null {
  return topKnown(distributionValue)?.percentage ?? null;
}

export function buildDiscoveryQualityAudit(
  items: DiscoveryQualitySourceItem[],
  now = new Date(),
  countryAvailable = false,
): DiscoveryQualityAudit {
  const sector = distribution('sector', 'Sector Mix', items, (item) => knownText(item.sector));
  const marketCap = distribution('market_cap', 'Market Cap Mix', items,
    (item) => marketCapBucket(item.marketCap), true, null, MARKET_CAP_BUCKETS);
  const country = distribution('country', 'Country Mix', items, (item) => knownText(item.country), countryAvailable,
    countryAvailable ? null : 'The current companies schema does not store country data.');
  const exchange = distribution('exchange', 'Exchange Mix', items, (item) => knownText(item.exchange));
  const distributions = [sector, marketCap, country, exchange];

  const appearances = new Map<string, DiscoveryQualitySourceItem[]>();
  const runIds = new Set<number>();
  for (const item of items) {
    const symbol = item.symbol.trim().toUpperCase();
    appearances.set(symbol, [...(appearances.get(symbol) || []), item]);
    runIds.add(item.runId);
  }
  const duplicates = [...appearances.entries()].map(([symbol, symbolItems]) => {
    const observed = symbolItems.map((item) => item.observedAt).sort();
    return {
      symbol,
      appearanceCount: symbolItems.length,
      firstSeen: observed[0],
      lastSeen: observed[observed.length - 1],
    };
  }).sort((a, b) => b.appearanceCount - a.appearanceCount || a.symbol.localeCompare(b.symbol));
  const repeatedSymbols = duplicates.filter((item) => item.appearanceCount > 1).length;
  const oneTimeSymbols = duplicates.length - repeatedSymbols;

  const scores = [
    scoreDistribution('growth', 'Growth Score', items, (item) => item.growthScore),
    scoreDistribution('health', 'Health Score', items, (item) => item.healthScore),
    scoreDistribution('coverage', 'Coverage Score', items, (item) => item.coverageScore),
    scoreDistribution('total', 'Total Score', items, (item) => item.totalScore, false,
      'Discovery ranking is lexicographic and does not store a Total Score. This audit does not invent one.'),
  ];

  const topThreeSectorCount = [...sector.buckets]
    .filter((bucket) => bucket.bucket !== 'Unknown')
    .sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket))
    .slice(0, 3)
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const concentration: DiscoveryQualityConcentration = {
    topSectorSharePct: topKnownShare(sector),
    topThreeSectorSharePct: sector.knownCount ? percentage(topThreeSectorCount, items.length) : null,
    topMarketCapBucketSharePct: topKnownShare(marketCap),
    topExchangeSharePct: topKnownShare(exchange),
    repeatAppearanceSharePct: percentage(items.length - duplicates.length, items.length),
  };
  const overview: DiscoveryQualityOverview = {
    totalItems: items.length,
    distinctSymbols: duplicates.length,
    collectionRuns: runIds.size,
    repeatedSymbols,
    oneTimeSymbols,
    knownSectorItems: sector.knownCount,
    knownMarketCapItems: marketCap.knownCount,
    knownCountryItems: country.knownCount,
    knownExchangeItems: exchange.knownCount,
  };

  const highlights: string[] = [];
  const commonSector = topKnown(sector);
  if (commonSector) highlights.push(`Most common sector: ${commonSector.bucket} (${commonSector.count} items, ${commonSector.percentage.toFixed(1)}%).`);
  const commonMarketCap = topKnown(marketCap);
  if (commonMarketCap) highlights.push(`Most common market-cap bucket: ${commonMarketCap.bucket} (${commonMarketCap.count} items, ${commonMarketCap.percentage.toFixed(1)}%).`);
  if (duplicates.length) {
    const maxAppearances = duplicates[0].appearanceCount;
    const leaders = duplicates.filter((item) => item.appearanceCount === maxAppearances);
    highlights.push(leaders.length === 1
      ? `Most frequently discovered symbol: ${leaders[0].symbol} (${maxAppearances} appearances).`
      : `${leaders.length} symbols tie for most frequent at ${maxAppearances} appearance${maxAppearances === 1 ? '' : 's'} each.`);
  }
  for (const score of scores.filter((item) => item.available && item.above80Percentage != null)) {
    highlights.push(`${score.above80Percentage!.toFixed(1)}% of items with a known ${score.title} are above 80 (${score.above80Count}/${score.availableCount}).`);
  }
  if (concentration.topThreeSectorSharePct != null) {
    highlights.push(`The top three known sectors account for ${concentration.topThreeSectorSharePct.toFixed(1)}% of all collection items.`);
  }

  return {
    generatedAt: now.toISOString(),
    sampleUnit: 'collection_run_item row',
    overview,
    distributions,
    duplicates,
    scores,
    concentration,
    highlights,
  };
}

function sourceQuery(countryAvailable: boolean): string {
  const country = countryAvailable ? 'c.country' : 'NULL::text';
  return `SELECT
     i.id AS item_id, i.collection_run_id AS run_id, i.ticker, i.observed_at,
     COALESCE(d.sector, c.sector) AS sector,
     COALESCE(d.market_cap, price.market_cap) AS market_cap,
     ${country} AS country,
     c.exchange,
     d.growth_score, d.health_score, d.coverage_score,
     NULL::numeric AS total_score
   FROM collection_run_items i
   LEFT JOIN companies c ON c.id = i.company_id
   LEFT JOIN LATERAL (
     SELECT dd.sector, dd.market_cap, dd.growth_score, dd.health_score, dd.coverage_score
     FROM discovery_decisions dd
     WHERE dd.collection_run_item_id = i.id
     ORDER BY dd.id DESC LIMIT 1
   ) d ON true
   LEFT JOIN LATERAL (
     SELECT p.market_cap
     FROM price_snapshots p
     WHERE p.company_id = i.company_id AND p.captured_at <= i.observed_at
     ORDER BY p.captured_at DESC, p.id DESC LIMIT 1
   ) price ON true
   ORDER BY i.observed_at, i.id`;
}

export async function getDiscoveryQualityAudit(now = new Date()): Promise<DiscoveryQualityAudit> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const countryCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'country'
       ) AS available`,
    );
    const countryAvailable = Boolean(countryCheck.rows[0]?.available);
    const result = await client.query(sourceQuery(countryAvailable));
    await client.query('COMMIT');
    return buildDiscoveryQualityAudit(result.rows.map((row) => ({
      itemId: Number(row.item_id),
      runId: Number(row.run_id),
      symbol: String(row.ticker),
      observedAt: new Date(row.observed_at).toISOString(),
      sector: row.sector == null ? null : String(row.sector),
      marketCap: row.market_cap == null ? null : Number(row.market_cap),
      country: row.country == null ? null : String(row.country),
      exchange: row.exchange == null ? null : String(row.exchange),
      growthScore: row.growth_score == null ? null : Number(row.growth_score),
      healthScore: row.health_score == null ? null : Number(row.health_score),
      coverageScore: row.coverage_score == null ? null : Number(row.coverage_score),
      totalScore: null,
    })), now, countryAvailable);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
