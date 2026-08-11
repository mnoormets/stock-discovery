import { ensureSchema, pool } from './db';

export const MIN_SECTOR_COMPARABLES = 5;

export type SectorGroupType = 'industry' | 'sector';
export type SectorRelativeStatus = 'available' | 'insufficient' | 'unknown';

export interface RelativeMetric {
  value: number | null;
  median: number | null;
  percentile: number | null;
}

export interface SectorRelativeStats {
  ticker: string;
  sector: string | null;
  industry: string | null;
  classificationSource: string | null;
  groupType: SectorGroupType | null;
  groupName: string | null;
  comparableCount: number;
  minimumComparableCount: number;
  status: SectorRelativeStatus;
  growth: RelativeMetric;
  health: RelativeMetric;
  coverage: RelativeMetric;
  marketCap: RelativeMetric;
}

interface ComparableRow {
  ticker: string;
  sector: string | null;
  industry: string | null;
  classificationSource: string | null;
  scoringVersion: string | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
  marketCap: number | null;
}

function normalized(value: string | null): string | null {
  const result = value?.trim().toLocaleLowerCase('en-US');
  return result || null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

// Tie-adjusted percentile rank: values below + half of equal values, divided by N.
// No percentile is returned until the selected group has at least five complete peers.
function percentile(value: number | null, values: number[], groupIsSufficient: boolean): number | null {
  if (value == null || !groupIsSufficient || values.length < MIN_SECTOR_COMPARABLES) return null;
  const below = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}

function metric(value: number | null, peers: ComparableRow[], key: 'growthScore' | 'healthScore' | 'coverageScore' | 'marketCap', sufficient: boolean): RelativeMetric {
  const values = peers.map((peer) => peer[key]).filter((item): item is number => item != null);
  return {
    value,
    median: sufficient && key !== 'marketCap' && values.length >= MIN_SECTOR_COMPARABLES ? median(values) : null,
    percentile: percentile(value, values, sufficient),
  };
}

function emptyStats(row: ComparableRow): SectorRelativeStats {
  return {
    ticker: row.ticker,
    sector: row.sector,
    industry: row.industry,
    classificationSource: row.classificationSource,
    groupType: null,
    groupName: null,
    comparableCount: 0,
    minimumComparableCount: MIN_SECTOR_COMPARABLES,
    status: 'unknown',
    growth: { value: row.growthScore, median: null, percentile: null },
    health: { value: row.healthScore, median: null, percentile: null },
    coverage: { value: row.coverageScore, median: null, percentile: null },
    marketCap: { value: row.marketCap, median: null, percentile: null },
  };
}

function calculateFor(row: ComparableRow, rows: ComparableRow[]): SectorRelativeStats {
  if (!row.sector && !row.industry) return emptyStats(row);
  const complete = rows.filter((peer) =>
    peer.scoringVersion === row.scoringVersion
    && peer.growthScore != null
    && peer.healthScore != null
    && peer.coverageScore != null,
  );
  const industryName = normalized(row.industry);
  const sectorName = normalized(row.sector);
  const industryPeers = industryName
    ? complete.filter((peer) => normalized(peer.industry) === industryName)
    : [];
  const sectorPeers = sectorName
    ? complete.filter((peer) => normalized(peer.sector) === sectorName)
    : [];

  let groupType: SectorGroupType;
  let groupName: string;
  let peers: ComparableRow[];
  if (row.industry && industryPeers.length >= MIN_SECTOR_COMPARABLES) {
    groupType = 'industry'; groupName = row.industry; peers = industryPeers;
  } else if (row.sector && sectorPeers.length >= MIN_SECTOR_COMPARABLES) {
    groupType = 'sector'; groupName = row.sector; peers = sectorPeers;
  } else if (row.industry && industryPeers.length >= sectorPeers.length) {
    groupType = 'industry'; groupName = row.industry; peers = industryPeers;
  } else if (row.sector) {
    groupType = 'sector'; groupName = row.sector!; peers = sectorPeers;
  } else {
    groupType = 'industry'; groupName = row.industry!; peers = industryPeers;
  }

  const sufficient = peers.length >= MIN_SECTOR_COMPARABLES;
  return {
    ticker: row.ticker,
    sector: row.sector,
    industry: row.industry,
    classificationSource: row.classificationSource,
    groupType,
    groupName,
    comparableCount: peers.length,
    minimumComparableCount: MIN_SECTOR_COMPARABLES,
    status: sufficient ? 'available' : 'insufficient',
    growth: metric(row.growthScore, peers, 'growthScore', sufficient),
    health: metric(row.healthScore, peers, 'healthScore', sufficient),
    coverage: metric(row.coverageScore, peers, 'coverageScore', sufficient),
    marketCap: metric(row.marketCap, peers, 'marketCap', sufficient),
  };
}

export async function getSectorRelativeStatsMap(tickers?: string[]): Promise<Map<string, SectorRelativeStats>> {
  await ensureSchema();
  const result = await pool.query(`
    SELECT c.ticker, c.sector, c.industry, c.classification_source,
      score.scoring_version, score.growth_score, score.health_score, score.coverage_score,
      price.market_cap
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT s.scoring_version, s.growth_score, s.health_score, s.coverage_score
      FROM company_score_snapshots s
      WHERE s.company_id = c.id
      ORDER BY s.calculated_at DESC, s.id DESC LIMIT 1
    ) score ON true
    LEFT JOIN LATERAL (
      SELECT p.market_cap FROM price_snapshots p
      WHERE p.company_id = c.id
      ORDER BY p.captured_at DESC, p.id DESC LIMIT 1
    ) price ON true
  `);
  const rows: ComparableRow[] = result.rows.map((row) => ({
    ticker: row.ticker,
    sector: row.sector || null,
    industry: row.industry || null,
    classificationSource: row.classification_source || null,
    scoringVersion: row.scoring_version || null,
    growthScore: row.growth_score == null ? null : Number(row.growth_score),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    coverageScore: row.coverage_score == null ? null : Number(row.coverage_score),
    marketCap: row.market_cap == null ? null : Number(row.market_cap),
  }));
  const requested = tickers?.length ? new Set(tickers.map((ticker) => ticker.toUpperCase())) : null;
  return new Map(
    rows
      .filter((row) => !requested || requested.has(row.ticker))
      .map((row) => [row.ticker, calculateFor(row, rows)]),
  );
}

export async function getSectorRelativeStats(ticker: string): Promise<SectorRelativeStats | null> {
  return (await getSectorRelativeStatsMap([ticker])).get(ticker.toUpperCase()) || null;
}
