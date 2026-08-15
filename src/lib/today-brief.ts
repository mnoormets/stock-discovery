import { pool } from './db';
import { toDateOnly } from './date-only';
import { CANONICAL_RUN_TYPE } from './discovery-validation';
import {
  getMissedMoveAuditsReadOnly,
  type MissedMoveAudit,
  type PriorCoverage,
} from './missed-moves';

export type TodayBriefStatus = 'ok' | 'waiting' | 'warning';
export type TodayQualityStatus = 'ok' | 'warning' | 'unknown';
export type TodayWarningSeverity = 'info' | 'warning' | 'critical';

export interface TodayBriefWarning {
  code: string;
  severity: TodayWarningSeverity;
  message: string;
}

export interface TodayCanonicalRun {
  id: number;
  decisionDate: string;
  runAt: string;
  modelVersion: string;
  evaluatedCount: number;
  includedCount: number;
  collectionRunId: number | null;
  inputChangedAfterCanonicalSnapshot: boolean | null;
}

export interface TodayCollectionRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failure';
  durationMs: number | null;
  trigger: string;
  metrics: {
    captureDate: string | null;
    scanned: number | null;
    candidates: number | null;
    flagged: number | null;
    liveDataSaved: boolean | null;
    marketDataGrowth: number | null;
    marketDataRecall: number | null;
    marketDataTotal: number | null;
  };
  errorMessage: string | null;
}

export interface TodayDataQuality {
  snapshotVersion: string;
  capturedAt: string;
  status: TodayQualityStatus;
  companiesTotal: number;
  companiesWithSecFacts: number;
  companiesWithScores: number;
  companiesWithSector: number;
  companiesWithRecentPrice: number;
  missingFinancialsCount: number;
  missingSectorCount: number;
  missingPriceCount: number;
  staleFinancialsCount: number;
  secCoveragePercent: number | null;
  scoreCoveragePercent: number | null;
  sectorCoveragePercent: number | null;
  recentPriceCoveragePercent: number | null;
  warnings: string[];
}

export type TodayCandidateWarningCode =
  | 'low_coverage'
  | 'not_relevant_mandate'
  | 'partial_mandate'
  | 'negative_fcf'
  | 'dilution_warning'
  | 'missing_sector'
  | 'unknown_provenance';

export interface TodayCandidateWarning {
  code: TodayCandidateWarningCode;
  label: string;
}

export interface TodayCandidate {
  decisionId: number;
  ticker: string;
  companyName: string | null;
  rank: number | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  mandateRelevance: string;
  catalystStatus: string;
  catalystTier: number | null;
  catalystMateriality: string;
  lookupBucket: string;
  decisionPrice: number | null;
  currency: string | null;
  warnings: TodayCandidateWarning[];
}

export interface TodayWatchItem {
  code: string;
  severity: TodayWarningSeverity;
  ticker: string | null;
  title: string;
  detail: string;
  href: string | null;
}

export interface TodayChanges {
  available: boolean;
  previousRunId: number | null;
  previousDecisionDate: string | null;
  modelVersionChanged: boolean;
  newIncludedTickers: string[];
  removedTickers: string[];
  repeatedTickers: string[];
}

export interface TodayMissedMoveSummary {
  available: boolean;
  total: number;
  byReason: Record<PriorCoverage, number>;
  recent: MissedMoveAudit[];
}

export interface TodayOutcomeSummary {
  pendingCount: number;
  measuredCount: number;
  missingCount: number;
  unavailableCount: number;
  nextMeasurable: Array<{
    horizon: string;
    count: number;
    firstTargetAt: string;
  }>;
}

export interface TodayBrief {
  todayTallinnDate: string;
  status: TodayBriefStatus;
  hasTodayCanonicalRun: boolean;
  canonicalRunCount: number;
  latestCanonicalRun: TodayCanonicalRun | null;
  latestCollectionRun: TodayCollectionRun | null;
  dataQuality: TodayDataQuality | null;
  topCandidates: TodayCandidate[];
  watchItems: TodayWatchItem[];
  changes: TodayChanges;
  missedMovesSummary: TodayMissedMoveSummary;
  outcomes: TodayOutcomeSummary;
  warnings: TodayBriefWarning[];
}

const LOW_COVERAGE_THRESHOLD = 70;
const HIGH_GROWTH_THRESHOLD = 65;

function tallinnDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function percent(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

function stringSet(value: unknown): Set<string> {
  return new Set(arrayValue(value).map(String));
}

function mapCanonicalRun(row: any): TodayCanonicalRun {
  return {
    id: Number(row.id),
    decisionDate: toDateOnly(row.decision_date),
    runAt: new Date(row.run_at).toISOString(),
    modelVersion: String(row.model_version),
    evaluatedCount: Number(row.evaluated_count),
    includedCount: Number(row.included_count),
    collectionRunId: row.collection_run_id == null ? null : Number(row.collection_run_id),
    // Seda runtime-return väärtust ei ole ajalooliselt DB-sse salvestatud.
    // Read-only brief ei rekonstrueeri tänase inputiga mineviku flagi.
    inputChangedAfterCanonicalSnapshot: null,
  };
}

function mapCollectionRun(row: any): TodayCollectionRun {
  const metrics = objectValue(row.metrics);
  const lookup = objectValue(metrics.marketDataLookup);
  return {
    id: Number(row.id),
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    status: row.status,
    durationMs: numberValue(row.duration_ms),
    trigger: String(row.trigger),
    metrics: {
      captureDate: typeof metrics.captureDate === 'string' ? metrics.captureDate : null,
      scanned: numberValue(metrics.scanned),
      candidates: numberValue(metrics.candidates),
      flagged: numberValue(metrics.flagged),
      liveDataSaved: booleanValue(metrics.liveDataSaved),
      marketDataGrowth: numberValue(lookup.growth),
      marketDataRecall: numberValue(lookup.recall),
      marketDataTotal: numberValue(lookup.total),
    },
    errorMessage: row.error_message || null,
  };
}

function candidateWarnings(row: any, qualityMetrics: Record<string, unknown>): TodayCandidateWarning[] {
  const flags = objectValue(qualityMetrics.flags);
  const ticker = String(row.ticker);
  const warnings: TodayCandidateWarning[] = [];
  if (Number(row.coverage_score) < LOW_COVERAGE_THRESHOLD) {
    warnings.push({ code: 'low_coverage', label: 'Low coverage' });
  }
  if (row.catalyst_mandate_relevance === 'not_relevant') {
    warnings.push({ code: 'not_relevant_mandate', label: 'Off mandate' });
  }
  if (row.catalyst_mandate_relevance === 'partial') {
    warnings.push({ code: 'partial_mandate', label: 'Partial mandate' });
  }
  if (stringSet(flags.negativeFcfTickers).has(ticker)) {
    warnings.push({ code: 'negative_fcf', label: 'Negative FCF' });
  }
  if (stringSet(flags.dilutionWarningTickers).has(ticker)) {
    warnings.push({ code: 'dilution_warning', label: 'Dilution warning' });
  }
  if (!row.sector || !String(row.sector).trim()) {
    warnings.push({ code: 'missing_sector', label: 'Missing sector' });
  }
  if (!row.collection_run_item_id || !row.lookup_bucket || row.lookup_bucket === 'unknown') {
    warnings.push({ code: 'unknown_provenance', label: 'Unknown provenance' });
  }
  return warnings;
}

function emptyChanges(): TodayChanges {
  return {
    available: false,
    previousRunId: null,
    previousDecisionDate: null,
    modelVersionChanged: false,
    newIncludedTickers: [],
    removedTickers: [],
    repeatedTickers: [],
  };
}

function emptyMissedMoves(): TodayMissedMoveSummary {
  return {
    available: true,
    total: 0,
    byReason: { included: 0, excluded: 0, radar_data_gap: 0, universe_gap: 0 },
    recent: [],
  };
}

/**
 * Loeb morning brief'i ühe REPEATABLE READ / READ ONLY transaktsioonina.
 * Funktsioon ei kutsu ensureSchema(), collectorit, outcome refresh'i ega ühtki
 * write-on-read route'i.
 */
export async function getTodayBrief(now = new Date()): Promise<TodayBrief> {
  const todayTallinnDate = tallinnDate(now);
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const canonicalResult = await client.query(
      `WITH canonical_days AS (
         SELECT DISTINCT ON (decision_date)
           id, decision_date::text AS decision_date, run_at, model_version, evaluated_count,
           included_count, collection_run_id
         FROM discovery_runs
         WHERE run_type = $1
         ORDER BY decision_date, run_at DESC, id DESC
       )
       SELECT *, count(*) OVER ()::int AS canonical_run_count
       FROM canonical_days
       ORDER BY decision_date DESC, run_at DESC, id DESC
       LIMIT 2`,
      [CANONICAL_RUN_TYPE],
    );
    const latestCanonicalRun = canonicalResult.rows[0]
      ? mapCanonicalRun(canonicalResult.rows[0])
      : null;
    const previousCanonicalRun = canonicalResult.rows[1]
      ? mapCanonicalRun(canonicalResult.rows[1])
      : null;
    const canonicalRunCount = canonicalResult.rows[0]
      ? Number(canonicalResult.rows[0].canonical_run_count)
      : 0;

    const collectionResult = await client.query(
      `SELECT id, started_at, finished_at, status, duration_ms, trigger,
              metrics, error_message
       FROM collection_runs
       ORDER BY started_at DESC, id DESC
       LIMIT 1`,
    );
    const latestCollectionRun = collectionResult.rows[0]
      ? mapCollectionRun(collectionResult.rows[0])
      : null;

    let dataQuality: TodayDataQuality | null = null;
    let qualityMetrics: Record<string, unknown> = {};
    if (latestCanonicalRun) {
      const qualityResult = await client.query(
        `SELECT snapshot_version, captured_at, companies_total,
                companies_with_sec_facts, companies_with_scores,
                companies_with_sector, companies_with_recent_price,
                missing_financials_count, missing_sector_count,
                missing_price_count, stale_financials_count, metrics, warnings
         FROM data_quality_snapshots
         WHERE run_id = $1`,
        [latestCanonicalRun.id],
      );
      if (qualityResult.rows[0]) {
        const row = qualityResult.rows[0];
        const companiesTotal = Number(row.companies_total);
        const warnings = arrayValue(row.warnings).map(String);
        qualityMetrics = objectValue(row.metrics);
        const hasQualityGap = warnings.length > 0
          || Number(row.missing_financials_count) > 0
          || Number(row.missing_sector_count) > 0
          || Number(row.missing_price_count) > 0
          || Number(row.stale_financials_count) > 0;
        dataQuality = {
          snapshotVersion: String(row.snapshot_version),
          capturedAt: new Date(row.captured_at).toISOString(),
          status: companiesTotal === 0 ? 'unknown' : hasQualityGap ? 'warning' : 'ok',
          companiesTotal,
          companiesWithSecFacts: Number(row.companies_with_sec_facts),
          companiesWithScores: Number(row.companies_with_scores),
          companiesWithSector: Number(row.companies_with_sector),
          companiesWithRecentPrice: Number(row.companies_with_recent_price),
          missingFinancialsCount: Number(row.missing_financials_count),
          missingSectorCount: Number(row.missing_sector_count),
          missingPriceCount: Number(row.missing_price_count),
          staleFinancialsCount: Number(row.stale_financials_count),
          secCoveragePercent: percent(Number(row.companies_with_sec_facts), companiesTotal),
          scoreCoveragePercent: percent(Number(row.companies_with_scores), companiesTotal),
          sectorCoveragePercent: percent(Number(row.companies_with_sector), companiesTotal),
          recentPriceCoveragePercent: percent(Number(row.companies_with_recent_price), companiesTotal),
          warnings,
        };
      }
    }

    let topCandidates: TodayCandidate[] = [];
    if (latestCanonicalRun) {
      const candidateResult = await client.query(
        `SELECT d.id, d.ticker, d.candidate_rank, d.growth_score,
                d.health_score, d.coverage_score, d.decision_price, d.currency,
                d.catalyst_status, d.catalyst_evidence_tier,
                d.catalyst_materiality, d.catalyst_mandate_relevance,
                d.sector, d.collection_run_item_id,
                c.name AS company_name, i.lookup_bucket
         FROM discovery_decisions d
         LEFT JOIN companies c ON c.id = d.company_id
         LEFT JOIN collection_run_items i ON i.id = d.collection_run_item_id
         WHERE d.run_id = $1 AND d.included = true
         ORDER BY d.candidate_rank NULLS LAST, d.ticker`,
        [latestCanonicalRun.id],
      );
      topCandidates = candidateResult.rows.map((row) => ({
        decisionId: Number(row.id),
        ticker: String(row.ticker),
        companyName: row.company_name || null,
        rank: numberValue(row.candidate_rank),
        growthScore: numberValue(row.growth_score),
        healthScore: numberValue(row.health_score),
        coverageScore: Number(row.coverage_score),
        mandateRelevance: row.catalyst_mandate_relevance || 'unknown',
        catalystStatus: row.catalyst_status || 'unknown',
        catalystTier: numberValue(row.catalyst_evidence_tier),
        catalystMateriality: row.catalyst_materiality || 'unknown',
        lookupBucket: row.lookup_bucket || 'unknown',
        decisionPrice: numberValue(row.decision_price),
        currency: row.currency || null,
        warnings: candidateWarnings(row, qualityMetrics),
      }));
    }

    let changes = emptyChanges();
    if (latestCanonicalRun && previousCanonicalRun) {
      const changeResult = await client.query(
        `SELECT run_id, ticker
         FROM discovery_decisions
         WHERE included = true AND run_id = ANY($1::bigint[])
         ORDER BY run_id, ticker`,
        [[latestCanonicalRun.id, previousCanonicalRun.id]],
      );
      const latestTickers = new Set<string>();
      const previousTickers = new Set<string>();
      for (const row of changeResult.rows) {
        const target = Number(row.run_id) === latestCanonicalRun.id ? latestTickers : previousTickers;
        target.add(String(row.ticker));
      }
      changes = {
        available: true,
        previousRunId: previousCanonicalRun.id,
        previousDecisionDate: previousCanonicalRun.decisionDate,
        modelVersionChanged: previousCanonicalRun.modelVersion !== latestCanonicalRun.modelVersion,
        newIncludedTickers: [...latestTickers].filter((ticker) => !previousTickers.has(ticker)).sort(),
        removedTickers: [...previousTickers].filter((ticker) => !latestTickers.has(ticker)).sort(),
        repeatedTickers: [...latestTickers].filter((ticker) => previousTickers.has(ticker)).sort(),
      };
    }

    const outcomeCountResult = await client.query(
      `SELECT o.status, count(*)::int AS count
       FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id
       JOIN discovery_runs r ON r.id = d.run_id
       WHERE r.run_type = $1
       GROUP BY o.status`,
      [CANONICAL_RUN_TYPE],
    );
    const outcomeCounts = new Map<string, number>(
      outcomeCountResult.rows.map((row) => [String(row.status), Number(row.count)]),
    );
    const nextOutcomeResult = await client.query(
      `SELECT o.horizon, count(*)::int AS count, min(o.target_at) AS first_target_at
       FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id
       JOIN discovery_runs r ON r.id = d.run_id
       WHERE r.run_type = $1 AND o.status = 'pending'
       GROUP BY o.horizon
       ORDER BY min(o.target_at), o.horizon`,
      [CANONICAL_RUN_TYPE],
    );
    const outcomes: TodayOutcomeSummary = {
      pendingCount: outcomeCounts.get('pending') || 0,
      measuredCount: outcomeCounts.get('measured') || 0,
      missingCount: outcomeCounts.get('missing') || 0,
      unavailableCount: outcomeCounts.get('unavailable') || 0,
      nextMeasurable: nextOutcomeResult.rows.map((row) => ({
        horizon: String(row.horizon),
        count: Number(row.count),
        firstTargetAt: new Date(row.first_target_at).toISOString(),
      })),
    };

    let missedMovesSummary = emptyMissedMoves();
    await client.query('SAVEPOINT today_missed_moves');
    try {
      const missedMoves = await getMissedMoveAuditsReadOnly(client, { lookbackDays: 60, thresholdPercent: 8 });
      for (const move of missedMoves) missedMovesSummary.byReason[move.priorCoverage] += 1;
      missedMovesSummary.total = missedMoves.length;
      missedMovesSummary.recent = missedMoves.slice(0, 5);
      await client.query('RELEASE SAVEPOINT today_missed_moves');
    } catch {
      // Missed moves is useful context, but it must not make the whole morning
      // brief unavailable when its optional audit query cannot be evaluated.
      await client.query('ROLLBACK TO SAVEPOINT today_missed_moves');
      await client.query('RELEASE SAVEPOINT today_missed_moves');
      missedMovesSummary = { ...emptyMissedMoves(), available: false };
    }

    const hasTodayCanonicalRun = latestCanonicalRun?.decisionDate === todayTallinnDate;
    const warnings: TodayBriefWarning[] = [];
    if (!hasTodayCanonicalRun) {
      warnings.push({
        code: 'today_canonical_missing',
        severity: 'warning',
        message: `Tallinna kuupäeval ${todayTallinnDate} ei ole canonical discovery run'i.`,
      });
    }
    if (!latestCanonicalRun) {
      warnings.push({
        code: 'canonical_history_empty',
        severity: 'critical',
        message: 'Canonical discovery ajalugu puudub.',
      });
    } else if (!dataQuality) {
      warnings.push({
        code: 'data_quality_snapshot_missing',
        severity: 'critical',
        message: `Latest canonical run #${latestCanonicalRun.id} ei oma data-quality snapshot'i.`,
      });
    }
    if (latestCollectionRun?.status === 'failure') {
      warnings.push({
        code: 'latest_collection_failed',
        severity: 'critical',
        message: `Viimane collection run #${latestCollectionRun.id} ebaõnnestus.`,
      });
    }
    if (latestCanonicalRun) {
      warnings.push({
        code: 'canonical_input_change_unknown',
        severity: 'info',
        message: 'inputChangedAfterCanonicalSnapshot ei ole ajalooliselt DB-s salvestatud; brief näitab seda unknown väärtusena.',
      });
    }
    if (!missedMovesSummary.available) {
      warnings.push({
        code: 'missed_moves_unavailable',
        severity: 'info',
        message: "Missed-move kokkuvõte ei olnud selles brief'is saadaval.",
      });
    }
    if (changes.modelVersionChanged) {
      warnings.push({
        code: 'model_version_changed',
        severity: 'warning',
        message: 'Viimane ja eelmine canonical päev kasutavad eri mudeliversiooni; tickerimuutust tuleb tõlgendada ettevaatlikult.',
      });
    }

    const watchItems: TodayWatchItem[] = [];
    if (!hasTodayCanonicalRun) {
      watchItems.push({
        code: 'today_canonical_missing', severity: 'warning', ticker: null,
        title: 'Tänane canonical run puudub',
        detail: 'Kontrolli collect logi ja ära käsitle eilset nimekirja tänase värske valikuna.',
        href: null,
      });
    }
    if (latestCollectionRun?.status === 'failure') {
      watchItems.push({
        code: 'latest_collection_failed', severity: 'critical', ticker: null,
        title: `Collection run #${latestCollectionRun.id} failed`,
        detail: latestCollectionRun.errorMessage || 'Veateade puudub; kontrolli collection ledgerit.',
        href: null,
      });
    }
    if (dataQuality?.status !== 'ok') {
      watchItems.push({
        code: 'data_quality_warning', severity: dataQuality ? 'warning' : 'critical', ticker: null,
        title: dataQuality ? 'Data quality vajab kontrolli' : 'Data quality snapshot puudub',
        detail: dataQuality
          ? `${dataQuality.missingFinancialsCount} finantsideta, ${dataQuality.missingSectorCount} sektorita, ${dataQuality.staleFinancialsCount} stale.`
          : 'Latest canonical otsuse sisendkvaliteeti ei saa tõendada.',
        href: null,
      });
    }
    for (const candidate of topCandidates) {
      if (candidate.mandateRelevance === 'not_relevant') {
        watchItems.push({
          code: 'not_relevant_mandate', severity: 'critical', ticker: candidate.ticker,
          title: `${candidate.ticker}: included, kuid off-mandate`,
          detail: 'Kontrolli käsitsi, miks kandidaat kaasati ja kas teesi mandaat tegelikult sobib.',
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if ((candidate.growthScore ?? 0) >= HIGH_GROWTH_THRESHOLD
          && candidate.coverageScore < LOW_COVERAGE_THRESHOLD) {
        watchItems.push({
          code: 'high_score_low_coverage', severity: 'warning', ticker: candidate.ticker,
          title: `${candidate.ticker}: kõrge Growth, madal coverage`,
          detail: `Growth ${candidate.growthScore}, coverage ${candidate.coverageScore}. Kontrolli puuduvaid score-sisendeid.`,
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if (candidate.lookupBucket === 'recall') {
        watchItems.push({
          code: 'recall_candidate', severity: 'info', ticker: candidate.ticker,
          title: `${candidate.ticker}: recall bucket`,
          detail: "Ticker jõudis lookup'i absoluutse tähelepanu, mitte mainimiste kasvu kaudu; kontrolli, mis tähelepanu hoidis.",
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
    }
    for (const move of missedMovesSummary.recent.filter((item) => item.priorCoverage === 'universe_gap')) {
      watchItems.push({
        code: 'missed_move_universe_gap', severity: 'warning', ticker: move.ticker,
        title: `${move.ticker}: missed-move universe gap`,
        detail: `${move.changePercent >= 0 ? '+' : ''}${move.changePercent.toFixed(1)}% ${move.previousDate} → ${move.observedDate}; enne liikumist polnud canonical universumis ega radaris.`,
        href: '/missed-moves',
      });
    }

    const status: TodayBriefStatus = latestCollectionRun?.status === 'failure'
      ? 'warning'
      : hasTodayCanonicalRun ? 'ok' : 'waiting';

    await client.query('COMMIT');
    return {
      todayTallinnDate,
      status,
      hasTodayCanonicalRun,
      canonicalRunCount,
      latestCanonicalRun,
      latestCollectionRun,
      dataQuality,
      topCandidates,
      watchItems: watchItems.slice(0, 12),
      changes,
      missedMovesSummary,
      outcomes,
      warnings,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
