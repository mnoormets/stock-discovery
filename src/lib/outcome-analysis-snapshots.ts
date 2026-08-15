import { pool } from './db';
import type { CollectionLookupBucket } from './collection-run-items';

export const OUTCOME_ANALYSIS_SNAPSHOT_VERSION = 'outcome-analysis-snapshot-v1';

export type WinnerStatus = 'winner' | 'not_winner' | 'unknown';
export type BenchmarkBeatStatus = 'beat' | 'not_beat' | 'unknown';
export type OutcomeDataQualityStatus = 'available' | 'unknown';
export type OutcomeAnalysisScope = 'canonical' | 'manual' | 'unknown';

export interface OutcomeAnalysisSnapshotInput {
  outcomeId: number;
  decisionId: number;
  collectionRunItemId: number | null;
  dataQualitySnapshotId: number | null;
  snapshotVersion: string;
  ticker: string;
  horizon: string;
  decisionScope: OutcomeAnalysisScope;
  candidateReturnPercent: number | null;
  winnerStatus: WinnerStatus;
  benchmarkReturnPercent: number | null;
  excessReturnPercent: number | null;
  benchmarkBeatStatus: BenchmarkBeatStatus;
  growthScore: number | null;
  coverageScore: number | null;
  lookupBucket: CollectionLookupBucket;
  marketDataAttempted: boolean | null;
  marketDataFound: boolean | null;
  marketDataSource: string | null;
  catalystEvidenceTier: number | null;
  catalystMandateRelevance: string;
  dataQualityStatus: OutcomeDataQualityStatus;
  secFactsCoveragePercent: number | null;
  scoreCoveragePercent: number | null;
  recentPriceCoveragePercent: number | null;
  staleFinancialsPercent: number | null;
  missingFinancialsPercent: number | null;
  lowCoveragePercent: number | null;
  dataQualityMetrics: Record<string, unknown>;
  warnings: string[];
}

export interface OutcomeAnalysisSnapshotRecord extends OutcomeAnalysisSnapshotInput {
  id: number;
  capturedAt: string;
}

export interface OutcomeAnalysisGroup {
  value: string;
  snapshotCount: number;
  knownWinnerCount: number;
  winnerCount: number;
  winnerPercent: number | null;
  knownBenchmarkCount: number;
  benchmarkBeatCount: number;
  benchmarkBeatPercent: number | null;
  averageReturnPercent: number | null;
  averageExcessReturnPercent: number | null;
  averageGrowthScore: number | null;
  averageCoverageScore: number | null;
  averageSecFactsCoveragePercent: number | null;
  averageScoreCoveragePercent: number | null;
  averageRecentPriceCoveragePercent: number | null;
}

export interface OutcomeAnalysisSummary {
  snapshotVersion: string;
  snapshotCount: number;
  excludedNonCanonicalCount: number;
  byWinnerStatus: OutcomeAnalysisGroup[];
  byLookupBucket: OutcomeAnalysisGroup[];
  byCatalystTier: OutcomeAnalysisGroup[];
  byMandateRelevance: OutcomeAnalysisGroup[];
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentage(part: unknown, total: unknown): number | null {
  const numerator = numberOrNull(part);
  const denominator = numberOrNull(total);
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function winnerStatus(value: number | null): WinnerStatus {
  if (value == null) return 'unknown';
  return value > 0 ? 'winner' : 'not_winner';
}

function benchmarkBeatStatus(value: number | null): BenchmarkBeatStatus {
  if (value == null) return 'unknown';
  return value > 0 ? 'beat' : 'not_beat';
}

function mapRow(row: any): OutcomeAnalysisSnapshotRecord {
  return {
    id: Number(row.id),
    outcomeId: Number(row.outcome_id),
    decisionId: Number(row.decision_id),
    collectionRunItemId: row.collection_run_item_id == null ? null : Number(row.collection_run_item_id),
    dataQualitySnapshotId: row.data_quality_snapshot_id == null ? null : Number(row.data_quality_snapshot_id),
    snapshotVersion: String(row.snapshot_version),
    capturedAt: new Date(row.captured_at).toISOString(),
    ticker: String(row.ticker),
    horizon: String(row.horizon),
    decisionScope: row.decision_scope,
    candidateReturnPercent: numberOrNull(row.candidate_return_percent),
    winnerStatus: row.winner_status,
    benchmarkReturnPercent: numberOrNull(row.benchmark_return_percent),
    excessReturnPercent: numberOrNull(row.excess_return_percent),
    benchmarkBeatStatus: row.benchmark_beat_status,
    growthScore: numberOrNull(row.growth_score),
    coverageScore: numberOrNull(row.coverage_score),
    lookupBucket: row.lookup_bucket,
    marketDataAttempted: row.market_data_attempted == null ? null : Boolean(row.market_data_attempted),
    marketDataFound: row.market_data_found == null ? null : Boolean(row.market_data_found),
    marketDataSource: row.market_data_source || null,
    catalystEvidenceTier: row.catalyst_evidence_tier == null ? null : Number(row.catalyst_evidence_tier),
    catalystMandateRelevance: String(row.catalyst_mandate_relevance),
    dataQualityStatus: row.data_quality_status,
    secFactsCoveragePercent: numberOrNull(row.sec_facts_coverage_percent),
    scoreCoveragePercent: numberOrNull(row.score_coverage_percent),
    recentPriceCoveragePercent: numberOrNull(row.recent_price_coverage_percent),
    staleFinancialsPercent: numberOrNull(row.stale_financials_percent),
    missingFinancialsPercent: numberOrNull(row.missing_financials_percent),
    lowCoveragePercent: numberOrNull(row.low_coverage_percent),
    dataQualityMetrics: objectOrEmpty(row.data_quality_metrics),
    warnings: arrayOrEmpty(row.warnings).map(String),
  };
}

export async function buildOutcomeAnalysisSnapshot(outcomeId: number): Promise<OutcomeAnalysisSnapshotInput> {
  if (!Number.isInteger(outcomeId) || outcomeId <= 0) throw new Error('outcomeId peab olema positiivne täisarv.');
  // Source boundary is deliberate: no live company, price, score, financial or
  // catalyst table participates. Everything below was already frozen into one
  // of the four allowed point-in-time tables.
  const { rows } = await pool.query(
    `SELECT
       o.id AS outcome_id, o.decision_id, o.horizon, o.status,
       o.return_percent, o.benchmark_return_percent, o.excess_return_percent,
       d.ticker, d.analysis_scope, d.growth_score, d.coverage_score,
       d.catalyst_evidence_tier, d.catalyst_mandate_relevance,
       d.collection_run_item_id,
       i.lookup_bucket, i.market_data_attempted, i.market_data_found, i.market_data_source,
       q.id AS data_quality_snapshot_id, q.snapshot_version AS data_quality_snapshot_version,
       q.evaluated_count AS quality_evaluated_count,
       q.companies_total AS quality_companies_total,
       q.companies_with_sec_facts, q.companies_with_scores,
       q.companies_with_recent_price, q.stale_financials_count,
       q.missing_financials_count, q.missing_price_count, q.missing_sector_count,
       q.low_coverage_count, q.metrics AS quality_metrics, q.warnings AS quality_warnings
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     LEFT JOIN collection_run_items i ON i.id = d.collection_run_item_id
     LEFT JOIN data_quality_snapshots q ON q.run_id = d.run_id
     WHERE o.id = $1`,
    [outcomeId],
  );
  const row = rows[0];
  if (!row) throw new Error(`Candidate outcome #${outcomeId} ei leitud.`);
  if (row.status !== 'measured') throw new Error(`Candidate outcome #${outcomeId} ei ole measured.`);

  const candidateReturn = numberOrNull(row.return_percent);
  const benchmarkReturn = numberOrNull(row.benchmark_return_percent);
  const excessReturn = numberOrNull(row.excess_return_percent);
  const qualityAvailable = row.data_quality_snapshot_id != null;
  const collectionAvailable = row.collection_run_item_id != null && row.lookup_bucket != null;
  const warnings: string[] = [];
  if (!collectionAvailable) warnings.push('collection_provenance_unknown');
  if (!qualityAvailable) warnings.push('data_quality_unknown');
  if (row.catalyst_evidence_tier == null) warnings.push('catalyst_tier_unknown');
  if (!row.catalyst_mandate_relevance) warnings.push('mandate_relevance_unknown');
  if (excessReturn == null) warnings.push('benchmark_beat_unknown');

  const qualityMetrics = qualityAvailable ? {
    snapshotVersion: row.data_quality_snapshot_version,
    evaluatedCount: Number(row.quality_evaluated_count),
    companiesTotal: Number(row.quality_companies_total),
    companiesWithSecFacts: Number(row.companies_with_sec_facts),
    companiesWithScores: Number(row.companies_with_scores),
    companiesWithRecentPrice: Number(row.companies_with_recent_price),
    staleFinancialsCount: Number(row.stale_financials_count),
    missingFinancialsCount: Number(row.missing_financials_count),
    missingPriceCount: Number(row.missing_price_count),
    missingSectorCount: Number(row.missing_sector_count),
    lowCoverageCount: Number(row.low_coverage_count),
    metrics: objectOrEmpty(row.quality_metrics),
    sourceWarnings: arrayOrEmpty(row.quality_warnings),
  } : {};

  return {
    outcomeId: Number(row.outcome_id),
    decisionId: Number(row.decision_id),
    collectionRunItemId: collectionAvailable ? Number(row.collection_run_item_id) : null,
    dataQualitySnapshotId: qualityAvailable ? Number(row.data_quality_snapshot_id) : null,
    snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
    ticker: String(row.ticker),
    horizon: String(row.horizon),
    decisionScope: row.analysis_scope || 'unknown',
    candidateReturnPercent: candidateReturn,
    winnerStatus: winnerStatus(candidateReturn),
    benchmarkReturnPercent: benchmarkReturn,
    excessReturnPercent: excessReturn,
    benchmarkBeatStatus: benchmarkBeatStatus(excessReturn),
    growthScore: numberOrNull(row.growth_score),
    coverageScore: numberOrNull(row.coverage_score),
    lookupBucket: collectionAvailable ? row.lookup_bucket : 'unknown',
    marketDataAttempted: collectionAvailable ? Boolean(row.market_data_attempted) : null,
    marketDataFound: collectionAvailable ? Boolean(row.market_data_found) : null,
    marketDataSource: collectionAvailable ? row.market_data_source || null : null,
    catalystEvidenceTier: row.catalyst_evidence_tier == null ? null : Number(row.catalyst_evidence_tier),
    catalystMandateRelevance: row.catalyst_mandate_relevance || 'unknown',
    dataQualityStatus: qualityAvailable ? 'available' : 'unknown',
    secFactsCoveragePercent: qualityAvailable
      ? percentage(row.companies_with_sec_facts, row.quality_companies_total) : null,
    scoreCoveragePercent: qualityAvailable
      ? percentage(row.companies_with_scores, row.quality_companies_total) : null,
    recentPriceCoveragePercent: qualityAvailable
      ? percentage(row.companies_with_recent_price, row.quality_companies_total) : null,
    staleFinancialsPercent: qualityAvailable
      ? percentage(row.stale_financials_count, row.quality_companies_total) : null,
    missingFinancialsPercent: qualityAvailable
      ? percentage(row.missing_financials_count, row.quality_companies_total) : null,
    lowCoveragePercent: qualityAvailable
      ? percentage(row.low_coverage_count, row.quality_evaluated_count) : null,
    dataQualityMetrics: qualityMetrics,
    warnings,
  };
}

export async function getOutcomeAnalysisSnapshotForOutcome(
  outcomeId: number,
): Promise<OutcomeAnalysisSnapshotRecord | null> {
  const { rows } = await pool.query('SELECT * FROM outcome_analysis_snapshots WHERE outcome_id = $1', [outcomeId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function recordOutcomeAnalysisSnapshot(outcomeId: number): Promise<OutcomeAnalysisSnapshotRecord> {
  const existing = await getOutcomeAnalysisSnapshotForOutcome(outcomeId);
  if (existing) {
    if (existing.snapshotVersion !== OUTCOME_ANALYSIS_SNAPSHOT_VERSION) {
      throw new Error(
        `Outcome #${outcomeId} snapshot on juba versiooniga ${existing.snapshotVersion}; vaikne overwrite on keelatud.`,
      );
    }
    return existing;
  }
  const input = await buildOutcomeAnalysisSnapshot(outcomeId);
  const values = [input.outcomeId, input.decisionId, input.collectionRunItemId,
    input.dataQualitySnapshotId, input.snapshotVersion, input.ticker, input.horizon,
    input.decisionScope,
    input.candidateReturnPercent, input.winnerStatus, input.benchmarkReturnPercent,
    input.excessReturnPercent, input.benchmarkBeatStatus, input.growthScore,
    input.coverageScore, input.lookupBucket, input.marketDataAttempted,
    input.marketDataFound, input.marketDataSource, input.catalystEvidenceTier,
    input.catalystMandateRelevance, input.dataQualityStatus,
    input.secFactsCoveragePercent, input.scoreCoveragePercent,
    input.recentPriceCoveragePercent, input.staleFinancialsPercent,
    input.missingFinancialsPercent, input.lowCoveragePercent,
    JSON.stringify(input.dataQualityMetrics), JSON.stringify(input.warnings)];
  const inserted = await pool.query(
    `INSERT INTO outcome_analysis_snapshots
      (outcome_id, decision_id, collection_run_item_id, data_quality_snapshot_id,
       snapshot_version, ticker, horizon, decision_scope, candidate_return_percent, winner_status,
       benchmark_return_percent, excess_return_percent, benchmark_beat_status,
       growth_score, coverage_score, lookup_bucket, market_data_attempted,
       market_data_found, market_data_source, catalyst_evidence_tier,
       catalyst_mandate_relevance, data_quality_status, sec_facts_coverage_percent,
       score_coverage_percent, recent_price_coverage_percent, stale_financials_percent,
       missing_financials_percent, low_coverage_percent, data_quality_metrics, warnings)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30::jsonb)
     ON CONFLICT (outcome_id) DO NOTHING
     RETURNING *`,
    values,
  );
  if (inserted.rows[0]) return mapRow(inserted.rows[0]);
  const concurrent = await getOutcomeAnalysisSnapshotForOutcome(outcomeId);
  if (!concurrent) throw new Error(`Outcome #${outcomeId} snapshoti salvestamine ebaõnnestus.`);
  if (concurrent.snapshotVersion !== OUTCOME_ANALYSIS_SNAPSHOT_VERSION) {
    throw new Error(`Outcome #${outcomeId} snapshoti versioonikonflikt.`);
  }
  return concurrent;
}

export async function recordMissingOutcomeAnalysisSnapshots(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT o.id
     FROM candidate_outcomes o
     LEFT JOIN outcome_analysis_snapshots s ON s.outcome_id = o.id
     WHERE o.status = 'measured' AND s.id IS NULL
     ORDER BY o.measured_at, o.id`,
  );
  let created = 0;
  for (const row of rows) {
    await recordOutcomeAnalysisSnapshot(Number(row.id));
    created += 1;
  }
  return created;
}

function average(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function groupStats(value: string, rows: OutcomeAnalysisSnapshotRecord[]): OutcomeAnalysisGroup {
  const knownWinner = rows.filter((row) => row.winnerStatus !== 'unknown');
  const knownBenchmark = rows.filter((row) => row.benchmarkBeatStatus !== 'unknown');
  const winners = knownWinner.filter((row) => row.winnerStatus === 'winner').length;
  const benchmarkBeats = knownBenchmark.filter((row) => row.benchmarkBeatStatus === 'beat').length;
  return {
    value,
    snapshotCount: rows.length,
    knownWinnerCount: knownWinner.length,
    winnerCount: winners,
    winnerPercent: knownWinner.length ? (winners / knownWinner.length) * 100 : null,
    knownBenchmarkCount: knownBenchmark.length,
    benchmarkBeatCount: benchmarkBeats,
    benchmarkBeatPercent: knownBenchmark.length ? (benchmarkBeats / knownBenchmark.length) * 100 : null,
    averageReturnPercent: average(rows.map((row) => row.candidateReturnPercent)),
    averageExcessReturnPercent: average(rows.map((row) => row.excessReturnPercent)),
    averageGrowthScore: average(rows.map((row) => row.growthScore)),
    averageCoverageScore: average(rows.map((row) => row.coverageScore)),
    averageSecFactsCoveragePercent: average(rows.map((row) => row.secFactsCoveragePercent)),
    averageScoreCoveragePercent: average(rows.map((row) => row.scoreCoveragePercent)),
    averageRecentPriceCoveragePercent: average(rows.map((row) => row.recentPriceCoveragePercent)),
  };
}

function grouped(
  rows: OutcomeAnalysisSnapshotRecord[],
  valueOf: (row: OutcomeAnalysisSnapshotRecord) => string,
): OutcomeAnalysisGroup[] {
  const groups = new Map<string, OutcomeAnalysisSnapshotRecord[]>();
  for (const row of rows) {
    const value = valueOf(row);
    groups.set(value, [...(groups.get(value) || []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, items]) => groupStats(value, items));
}

export async function getOutcomeAnalysisSummary(): Promise<OutcomeAnalysisSummary> {
  const { rows } = await pool.query(
    `SELECT * FROM outcome_analysis_snapshots
     WHERE snapshot_version = $1 ORDER BY captured_at, id`,
    [OUTCOME_ANALYSIS_SNAPSHOT_VERSION],
  );
  const allSnapshots = rows.map(mapRow);
  // Legacy candidate_outcomes can include manual runs from before the
  // canonical-only write boundary. Unknown/manual rows remain auditable
  // snapshots but never contaminate the default learning cohorts.
  const snapshots = allSnapshots.filter((row) => row.decisionScope === 'canonical');
  return {
    snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
    snapshotCount: snapshots.length,
    excludedNonCanonicalCount: allSnapshots.length - snapshots.length,
    byWinnerStatus: grouped(snapshots, (row) => row.winnerStatus),
    byLookupBucket: grouped(snapshots, (row) => row.lookupBucket),
    byCatalystTier: grouped(snapshots, (row) => row.catalystEvidenceTier == null
      ? 'unknown' : `tier_${row.catalystEvidenceTier}`),
    byMandateRelevance: grouped(snapshots, (row) => row.catalystMandateRelevance),
  };
}
