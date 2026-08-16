import { pool } from './db';
import { OUTCOME_ANALYSIS_SNAPSHOT_VERSION } from './outcome-analysis-snapshots';

export const OUTCOME_ATTRIBUTION_MIN_HIGHLIGHT_SAMPLE = 5;

export type OutcomeAttributionDimension =
  | 'total'
  | 'growth'
  | 'health'
  | 'coverage'
  | 'sector'
  | 'market_cap';

export interface OutcomeAttributionObservation {
  returnPct: number;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
  marketCap: number | null;
  sector: string | null;
}

export interface OutcomeAttributionBucket {
  bucket: string;
  sampleCount: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  loserRatePct: number | null;
}

export interface OutcomeAttributionSection {
  key: OutcomeAttributionDimension;
  title: string;
  available: boolean;
  unavailableReason: string | null;
  includedSampleCount: number;
  missingSignalCount: number;
  buckets: OutcomeAttributionBucket[];
}

export interface OutcomeAttributionHighlight {
  kind: 'best_average' | 'highest_win_rate' | 'worst_average';
  text: string;
  section: OutcomeAttributionDimension;
  bucket: string;
  sampleCount: number;
}

export interface OutcomeAttributionReport {
  snapshotVersion: string;
  sampleCount: number;
  minHighlightSample: number;
  sampleUnit: string;
  sections: OutcomeAttributionSection[];
  highlights: OutcomeAttributionHighlight[];
}

const SCORE_BUCKETS = ['0-20', '20-40', '40-60', '60-80', '80-100'] as const;
const MARKET_CAP_BUCKETS = ['nano', 'micro', 'small', 'mid', 'large'] as const;

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bucketMetrics(bucket: string, returns: number[]): OutcomeAttributionBucket {
  if (!returns.length) {
    return {
      bucket,
      sampleCount: 0,
      avgReturnPct: null,
      medianReturnPct: null,
      winRatePct: null,
      loserRatePct: null,
    };
  }
  const wins = returns.filter((value) => value > 10).length;
  const losses = returns.filter((value) => value < 0).length;
  return {
    bucket,
    sampleCount: returns.length,
    avgReturnPct: roundMetric(returns.reduce((sum, value) => sum + value, 0) / returns.length),
    medianReturnPct: roundMetric(median(returns)!),
    winRatePct: roundMetric((wins / returns.length) * 100),
    loserRatePct: roundMetric((losses / returns.length) * 100),
  };
}

export function scoreBucket(score: number | null): string | null {
  if (score == null || score < 0 || score > 100) return null;
  if (score < 20) return '0-20';
  if (score < 40) return '20-40';
  if (score < 60) return '40-60';
  if (score < 80) return '60-80';
  return '80-100';
}

export function marketCapBucket(marketCap: number | null): string | null {
  if (marketCap == null || marketCap < 0) return null;
  if (marketCap < 50_000_000) return 'nano';
  if (marketCap < 300_000_000) return 'micro';
  if (marketCap < 2_000_000_000) return 'small';
  if (marketCap < 10_000_000_000) return 'mid';
  return 'large';
}

function sectionFromKnownBuckets(
  key: OutcomeAttributionDimension,
  title: string,
  observations: OutcomeAttributionObservation[],
  orderedBuckets: readonly string[],
  bucketFor: (observation: OutcomeAttributionObservation) => string | null,
): OutcomeAttributionSection {
  const returnsByBucket = new Map(orderedBuckets.map((bucket) => [bucket, [] as number[]]));
  let missingSignalCount = 0;
  for (const observation of observations) {
    const bucket = bucketFor(observation);
    const returns = bucket ? returnsByBucket.get(bucket) : null;
    if (!returns) {
      missingSignalCount += 1;
      continue;
    }
    returns.push(observation.returnPct);
  }
  return {
    key,
    title,
    available: true,
    unavailableReason: null,
    includedSampleCount: observations.length - missingSignalCount,
    missingSignalCount,
    buckets: orderedBuckets.map((bucket) => bucketMetrics(bucket, returnsByBucket.get(bucket)!)),
  };
}

function sectorSection(observations: OutcomeAttributionObservation[]): OutcomeAttributionSection {
  const returnsBySector = new Map<string, number[]>();
  let missingSignalCount = 0;
  for (const observation of observations) {
    const sector = observation.sector?.trim();
    if (!sector) {
      missingSignalCount += 1;
      continue;
    }
    returnsBySector.set(sector, [...(returnsBySector.get(sector) || []), observation.returnPct]);
  }
  return {
    key: 'sector',
    title: 'Sector Attribution',
    available: true,
    unavailableReason: null,
    includedSampleCount: observations.length - missingSignalCount,
    missingSignalCount,
    buckets: [...returnsBySector.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, returns]) => bucketMetrics(bucket, returns)),
  };
}

function totalScoreUnavailable(sampleCount: number): OutcomeAttributionSection {
  return {
    key: 'total',
    title: 'Total Score Attribution',
    available: false,
    unavailableReason: 'Canonical RKLB decisions do not store a Total Score. Ranking is lexicographic, so this view does not invent a synthetic aggregate.',
    includedSampleCount: 0,
    missingSignalCount: sampleCount,
    buckets: [],
  };
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function highlightCandidates(sections: OutcomeAttributionSection[]) {
  return sections.flatMap((section) => section.available
    ? section.buckets
      .filter((bucket) => bucket.sampleCount >= OUTCOME_ATTRIBUTION_MIN_HIGHLIGHT_SAMPLE)
      .map((bucket) => ({ section, bucket }))
    : []);
}

export function buildOutcomeAttribution(
  observations: OutcomeAttributionObservation[],
): OutcomeAttributionReport {
  const sections: OutcomeAttributionSection[] = [
    totalScoreUnavailable(observations.length),
    sectionFromKnownBuckets('growth', 'Growth Attribution', observations, SCORE_BUCKETS,
      (observation) => scoreBucket(observation.growthScore)),
    sectionFromKnownBuckets('health', 'Health Attribution', observations, SCORE_BUCKETS,
      (observation) => scoreBucket(observation.healthScore)),
    sectionFromKnownBuckets('coverage', 'Coverage Attribution', observations, SCORE_BUCKETS,
      (observation) => scoreBucket(observation.coverageScore)),
    sectorSection(observations),
    sectionFromKnownBuckets('market_cap', 'Market Cap Attribution', observations, MARKET_CAP_BUCKETS,
      (observation) => marketCapBucket(observation.marketCap)),
  ];

  const eligible = highlightCandidates(sections);
  const highlights: OutcomeAttributionHighlight[] = [];
  const bestAverage = eligible
    .filter(({ bucket }) => bucket.avgReturnPct != null)
    .sort((a, b) => b.bucket.avgReturnPct! - a.bucket.avgReturnPct!
      || b.bucket.sampleCount - a.bucket.sampleCount
      || a.section.title.localeCompare(b.section.title)
      || a.bucket.bucket.localeCompare(b.bucket.bucket))[0];
  if (bestAverage) {
    highlights.push({
      kind: 'best_average',
      text: `Best average return: ${bestAverage.section.title.replace(' Attribution', '')} ${bestAverage.bucket.bucket} (${formatSignedPercent(bestAverage.bucket.avgReturnPct!)}, n=${bestAverage.bucket.sampleCount}).`,
      section: bestAverage.section.key,
      bucket: bestAverage.bucket.bucket,
      sampleCount: bestAverage.bucket.sampleCount,
    });
  }

  const highestWinRate = eligible
    .filter(({ bucket }) => bucket.winRatePct != null)
    .sort((a, b) => b.bucket.winRatePct! - a.bucket.winRatePct!
      || b.bucket.sampleCount - a.bucket.sampleCount
      || a.section.title.localeCompare(b.section.title)
      || a.bucket.bucket.localeCompare(b.bucket.bucket))[0];
  if (highestWinRate) {
    highlights.push({
      kind: 'highest_win_rate',
      text: `Highest win rate: ${highestWinRate.section.title.replace(' Attribution', '')} ${highestWinRate.bucket.bucket} (${highestWinRate.bucket.winRatePct!.toFixed(1)}%, n=${highestWinRate.bucket.sampleCount}).`,
      section: highestWinRate.section.key,
      bucket: highestWinRate.bucket.bucket,
      sampleCount: highestWinRate.bucket.sampleCount,
    });
  }

  const worstAverage = eligible
    .filter(({ bucket }) => bucket.avgReturnPct != null)
    .sort((a, b) => a.bucket.avgReturnPct! - b.bucket.avgReturnPct!
      || b.bucket.sampleCount - a.bucket.sampleCount
      || a.section.title.localeCompare(b.section.title)
      || a.bucket.bucket.localeCompare(b.bucket.bucket))[0];
  if (worstAverage) {
    highlights.push({
      kind: 'worst_average',
      text: `Worst average return: ${worstAverage.section.title.replace(' Attribution', '')} ${worstAverage.bucket.bucket} (${formatSignedPercent(worstAverage.bucket.avgReturnPct!)}, n=${worstAverage.bucket.sampleCount}).`,
      section: worstAverage.section.key,
      bucket: worstAverage.bucket.bucket,
      sampleCount: worstAverage.bucket.sampleCount,
    });
  }

  return {
    snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
    sampleCount: observations.length,
    minHighlightSample: OUTCOME_ATTRIBUTION_MIN_HIGHLIGHT_SAMPLE,
    sampleUnit: 'measured canonical candidate-horizon outcome',
    sections,
    highlights,
  };
}

export async function getOutcomeAttribution(): Promise<OutcomeAttributionReport> {
  const { rows } = await pool.query(
    `SELECT
       s.candidate_return_percent,
       s.growth_score,
       s.coverage_score,
       d.health_score,
       d.market_cap,
       d.sector
     FROM outcome_analysis_snapshots s
     JOIN discovery_decisions d ON d.id = s.decision_id
     WHERE s.snapshot_version = $1
       AND s.decision_scope = 'canonical'
       AND s.candidate_return_percent IS NOT NULL
     ORDER BY s.id`,
    [OUTCOME_ANALYSIS_SNAPSHOT_VERSION],
  );
  return buildOutcomeAttribution(rows.map((row) => ({
    returnPct: Number(row.candidate_return_percent),
    growthScore: numberOrNull(row.growth_score),
    healthScore: numberOrNull(row.health_score),
    coverageScore: numberOrNull(row.coverage_score),
    marketCap: numberOrNull(row.market_cap),
    sector: row.sector == null ? null : String(row.sector),
  })));
}
