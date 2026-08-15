import { pool } from './db';
import { STALE_FACT_DAYS } from './data-quality';
import { CANONICAL_RUN_TYPE } from './discovery-validation';

export const DATA_QUALITY_SNAPSHOT_VERSION = 'data-quality-snapshot-v1';
export const RECENT_PRICE_DAYS = 30;
export const LOW_COVERAGE_THRESHOLD = 70;

export class RequiredDataQualitySnapshotError extends Error {
  readonly runId: number;

  constructor(runId: number, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Canonical run #${runId} data-quality snapshot failed: ${detail}`);
    this.name = 'RequiredDataQualitySnapshotError';
    this.runId = runId;
  }
}

export interface DataQualitySnapshot {
  id: number;
  runId: number;
  snapshotVersion: string;
  capturedAt: string;
  evaluatedCount: number;
  includedCount: number;
  companiesTotal: number;
  companiesWithSecFacts: number;
  companiesWithScores: number;
  companiesWithSector: number;
  companiesWithRecentPrice: number;
  newestFinancialPeriodEnd: string | null;
  oldestFinancialPeriodEnd: string | null;
  staleFinancialsCount: number;
  missingFinancialsCount: number;
  missingPriceCount: number;
  missingSectorCount: number;
  lowCoverageCount: number;
  partialMandateCount: number;
  notRelevantMandateCount: number;
  negativeFcfCount: number;
  dilutionWarningCount: number;
  metrics: Record<string, unknown>;
  warnings: string[];
}

export interface BuiltDataQualitySnapshot extends Omit<DataQualitySnapshot, 'id' | 'capturedAt'> {}

export interface RecordedDataQualitySnapshot extends DataQualitySnapshot {
  created: boolean;
}

interface ScoreSource {
  metric?: unknown;
  latestValue?: unknown;
}

interface ScoreComponent {
  id?: unknown;
  score?: unknown;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function scoreSources(payload: unknown): ScoreSource[] {
  return jsonArray(jsonObject(payload).sources).map((source) => jsonObject(source));
}

function financialHealthComponents(payload: unknown): ScoreComponent[] {
  const scores = jsonObject(jsonObject(payload).scores);
  const financialHealth = jsonObject(scores.financialHealth);
  return jsonArray(financialHealth.components).map((component) => jsonObject(component));
}

function numberValue(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSnapshot(row: any): DataQualitySnapshot {
  const metrics = typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics;
  const warnings = typeof row.warnings === 'string' ? JSON.parse(row.warnings) : row.warnings;
  return {
    id: Number(row.id),
    runId: Number(row.run_id),
    snapshotVersion: String(row.snapshot_version),
    capturedAt: new Date(row.captured_at).toISOString(),
    evaluatedCount: Number(row.evaluated_count),
    includedCount: Number(row.included_count),
    companiesTotal: Number(row.companies_total),
    companiesWithSecFacts: Number(row.companies_with_sec_facts),
    companiesWithScores: Number(row.companies_with_scores),
    companiesWithSector: Number(row.companies_with_sector),
    companiesWithRecentPrice: Number(row.companies_with_recent_price),
    newestFinancialPeriodEnd: row.newest_financial_period_end
      ? String(row.newest_financial_period_end).slice(0, 10)
      : null,
    oldestFinancialPeriodEnd: row.oldest_financial_period_end
      ? String(row.oldest_financial_period_end).slice(0, 10)
      : null,
    staleFinancialsCount: Number(row.stale_financials_count),
    missingFinancialsCount: Number(row.missing_financials_count),
    missingPriceCount: Number(row.missing_price_count),
    missingSectorCount: Number(row.missing_sector_count),
    lowCoverageCount: Number(row.low_coverage_count),
    partialMandateCount: Number(row.partial_mandate_count),
    notRelevantMandateCount: Number(row.not_relevant_mandate_count),
    negativeFcfCount: Number(row.negative_fcf_count),
    dilutionWarningCount: Number(row.dilution_warning_count),
    metrics: jsonObject(metrics),
    warnings: jsonArray(warnings).map(String),
  };
}

export async function buildDataQualitySnapshot(runId: number): Promise<BuiltDataQualitySnapshot> {
  const runResult = await pool.query(
    `SELECT id, run_type, run_at, evaluated_count, included_count
     FROM discovery_runs WHERE id = $1`,
    [runId],
  );
  if (!runResult.rowCount) throw new Error(`Discovery run #${runId} does not exist.`);

  const run = runResult.rows[0];
  if (run.run_type !== CANONICAL_RUN_TYPE) {
    throw new Error(
      `Data-quality snapshots are only allowed for ${CANONICAL_RUN_TYPE} runs; run #${runId} is ${run.run_type}.`,
    );
  }
  const runAt = new Date(run.run_at).toISOString();
  const evaluatedCount = Number(run.evaluated_count);
  const includedCount = Number(run.included_count);

  // Universe on kõik run_at hetkeks tuntud mitte-ETF aktsiad (SPY benchmark
  // välja arvatud). Iga ajaliselt versioonitud allikas saab sama run_at piiri.
  const universeResult = await pool.query(
    `SELECT
       count(*)::int AS companies_total,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM financial_facts f
         WHERE f.company_id = c.id AND f.created_at <= $1
       ))::int AS companies_with_sec_facts,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM company_score_snapshots s
         WHERE s.company_id = c.id AND s.calculated_at <= $1
       ))::int AS companies_with_scores,
       count(*) FILTER (WHERE NULLIF(btrim(c.sector), '') IS NOT NULL)::int AS companies_with_sector,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM price_snapshots p
         WHERE p.company_id = c.id AND p.price IS NOT NULL
           AND p.captured_at <= $1
           AND p.captured_at >= $1::timestamptz - ($2::int * interval '1 day')
       ))::int AS companies_with_recent_price,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM financial_facts f
         WHERE f.company_id = c.id AND f.created_at <= $1
       ) AND NOT EXISTS (
         SELECT 1 FROM financial_facts f
         WHERE f.company_id = c.id AND f.created_at <= $1
           AND f.period_end >= ($1::timestamptz - ($3::int * interval '1 day'))::date
       ))::int AS stale_financials_count
     FROM companies c
     WHERE c.created_at <= $1
       AND c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'`,
    [runAt, RECENT_PRICE_DAYS, STALE_FACT_DAYS],
  );
  const universe = universeResult.rows[0];
  const companiesTotal = Number(universe.companies_total);
  const companiesWithSecFacts = Number(universe.companies_with_sec_facts);
  const companiesWithScores = Number(universe.companies_with_scores);
  const companiesWithSector = Number(universe.companies_with_sector);
  const companiesWithRecentPrice = Number(universe.companies_with_recent_price);
  const staleFinancialsCount = Number(universe.stale_financials_count);

  const periodResult = await pool.query(
    `SELECT min(f.period_end)::text AS oldest, max(f.period_end)::text AS newest
     FROM financial_facts f
     JOIN companies c ON c.id = f.company_id
     WHERE c.created_at <= $1 AND f.created_at <= $1
       AND c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'`,
    [runAt],
  );

  // Need väljad on recordDiscoveryRun'i immutable decision read ja otsusega
  // seotud score payload. Outcome-tabeleid see päring teadlikult ei puuduta.
  const decisionResult = await pool.query(
    `SELECT d.ticker, d.coverage_score, d.catalyst_mandate_relevance,
            d.score_snapshot_id, s.payload AS score_payload
     FROM discovery_decisions d
     LEFT JOIN company_score_snapshots s ON s.id = d.score_snapshot_id
     WHERE d.run_id = $1
     ORDER BY d.ticker`,
    [runId],
  );

  const lowCoverageTickers: string[] = [];
  const partialMandateTickers: string[] = [];
  const notRelevantMandateTickers: string[] = [];
  const negativeFcfTickers: string[] = [];
  const dilutionWarningTickers: string[] = [];
  const missingDecisionScoreTickers: string[] = [];

  for (const decision of decisionResult.rows) {
    const ticker = String(decision.ticker);
    if (Number(decision.coverage_score) < LOW_COVERAGE_THRESHOLD) lowCoverageTickers.push(ticker);
    if (decision.catalyst_mandate_relevance === 'partial') partialMandateTickers.push(ticker);
    if (decision.catalyst_mandate_relevance === 'not_relevant') notRelevantMandateTickers.push(ticker);
    if (decision.score_snapshot_id == null || decision.score_payload == null) {
      missingDecisionScoreTickers.push(ticker);
      continue;
    }
    const fcf = scoreSources(decision.score_payload).find((source) => source.metric === 'free_cash_flow');
    if (fcf && (numberValue(fcf.latestValue) ?? 0) < 0) negativeFcfTickers.push(ticker);
    const dilution = financialHealthComponents(decision.score_payload)
      .find((component) => component.id === 'dilution');
    if (dilution && (numberValue(dilution.score) ?? 100) < 40) dilutionWarningTickers.push(ticker);
  }

  const missingFinancialsCount = companiesTotal - companiesWithSecFacts;
  const missingPriceCount = companiesTotal - companiesWithRecentPrice;
  const missingSectorCount = companiesTotal - companiesWithSector;
  const warnings: string[] = [];
  if (decisionResult.rowCount !== evaluatedCount) {
    warnings.push(`Run says ${evaluatedCount} companies were evaluated, but ${decisionResult.rowCount} decision rows were found.`);
  }
  if (missingFinancialsCount > 0) warnings.push(`${missingFinancialsCount} companies have no SEC financial facts.`);
  if (missingPriceCount > 0) warnings.push(`${missingPriceCount} companies have no price from the last ${RECENT_PRICE_DAYS} days.`);
  if (missingSectorCount > 0) warnings.push(`${missingSectorCount} companies have no sector classification.`);
  if (staleFinancialsCount > 0) warnings.push(`${staleFinancialsCount} companies have financials older than ${STALE_FACT_DAYS} days.`);
  if (missingDecisionScoreTickers.length > 0) {
    warnings.push(`${missingDecisionScoreTickers.length} evaluated companies have no linked score snapshot.`);
  }

  return {
    runId,
    snapshotVersion: DATA_QUALITY_SNAPSHOT_VERSION,
    evaluatedCount,
    includedCount,
    companiesTotal,
    companiesWithSecFacts,
    companiesWithScores,
    companiesWithSector,
    companiesWithRecentPrice,
    newestFinancialPeriodEnd: periodResult.rows[0]?.newest || null,
    oldestFinancialPeriodEnd: periodResult.rows[0]?.oldest || null,
    staleFinancialsCount,
    missingFinancialsCount,
    missingPriceCount,
    missingSectorCount,
    lowCoverageCount: lowCoverageTickers.length,
    partialMandateCount: partialMandateTickers.length,
    notRelevantMandateCount: notRelevantMandateTickers.length,
    negativeFcfCount: negativeFcfTickers.length,
    dilutionWarningCount: dilutionWarningTickers.length,
    metrics: {
      asOf: runAt,
      universe: {
        definition: 'Known non-ETF companies excluding SPY, created on or before run_at.',
        recentPriceDays: RECENT_PRICE_DAYS,
        staleFinancialDays: STALE_FACT_DAYS,
      },
      thresholds: { lowCoverage: LOW_COVERAGE_THRESHOLD, dilutionComponentBelow: 40 },
      flags: {
        lowCoverageTickers,
        partialMandateTickers,
        notRelevantMandateTickers,
        negativeFcfTickers,
        dilutionWarningTickers,
        missingDecisionScoreTickers,
      },
      limitations: [
        'Sector classification is not versioned; the value visible when this immutable snapshot is first recorded is frozen.',
        'Financial facts are bounded by created_at and run_at; later in-place restatements cannot be reconstructed before this snapshot exists.',
      ],
    },
    warnings,
  };
}

export async function recordDataQualitySnapshot(runId: number): Promise<RecordedDataQualitySnapshot> {
  const built = await buildDataQualitySnapshot(runId);
  const inserted = await pool.query(
    `INSERT INTO data_quality_snapshots (
       run_id, snapshot_version, evaluated_count, included_count, companies_total,
       companies_with_sec_facts, companies_with_scores, companies_with_sector,
       companies_with_recent_price, newest_financial_period_end, oldest_financial_period_end,
       stale_financials_count, missing_financials_count, missing_price_count,
       missing_sector_count, low_coverage_count, partial_mandate_count,
       not_relevant_mandate_count, negative_fcf_count, dilution_warning_count,
       metrics, warnings
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb
     ) ON CONFLICT (run_id) DO NOTHING
     RETURNING *`,
    [
      built.runId, built.snapshotVersion, built.evaluatedCount, built.includedCount,
      built.companiesTotal, built.companiesWithSecFacts, built.companiesWithScores,
      built.companiesWithSector, built.companiesWithRecentPrice,
      built.newestFinancialPeriodEnd, built.oldestFinancialPeriodEnd,
      built.staleFinancialsCount, built.missingFinancialsCount, built.missingPriceCount,
      built.missingSectorCount, built.lowCoverageCount, built.partialMandateCount,
      built.notRelevantMandateCount, built.negativeFcfCount, built.dilutionWarningCount,
      JSON.stringify(built.metrics), JSON.stringify(built.warnings),
    ],
  );
  if (inserted.rowCount) return { ...mapSnapshot(inserted.rows[0]), created: true };

  const existing = await getDataQualitySnapshotForRun(runId);
  if (!existing) throw new Error(`Data-quality snapshot for run #${runId} disappeared during insert.`);
  if (existing.snapshotVersion !== DATA_QUALITY_SNAPSHOT_VERSION) {
    throw new Error(
      `Data-quality snapshot for run #${runId} is ${existing.snapshotVersion}; refusing to overwrite it with ${DATA_QUALITY_SNAPSHOT_VERSION}.`,
    );
  }
  return { ...existing, created: false };
}

export async function getDataQualitySnapshotForRun(runId: number): Promise<DataQualitySnapshot | null> {
  const result = await pool.query('SELECT * FROM data_quality_snapshots WHERE run_id = $1', [runId]);
  return result.rowCount ? mapSnapshot(result.rows[0]) : null;
}
