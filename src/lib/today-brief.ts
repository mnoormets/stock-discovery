import { pool } from './db';
import { toDateOnly } from './date-only';
import { priceObservationRecency } from './price-observation';
import { CANONICAL_RUN_TYPE } from './discovery-validation';
import {
  getMissedMoveAuditsReadOnly,
  type MissedMoveAudit,
  type PriorCoverage,
} from './missed-moves';
import {
  buildPriceContext,
  type CandidatePriceContext,
  type StoredPriceObservation,
} from './price-context';
import { buildScenarioValuation, type ScenarioValuation } from './scenario-valuation';
import type { ValuationEvidenceInput, ValuationInputMetric } from './valuation-evidence';
import {
  countSupportedRankingCriteria,
  explainAdjacentRklbRanks,
  type RklbAdjacentRankExplanation,
  type RklbRankFactors,
} from './rklb-ranking';
import { parseTodayInsiderEvidence, type TodayInsiderEvidence } from './today-insider-evidence';

export type TodayBriefStatus = 'ready' | 'waiting' | 'attention' | 'error';
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
    marketDataInsider: number | null;
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
  | 'stale_price'
  | 'low_coverage'
  | 'not_relevant_mandate'
  | 'partial_mandate'
  | 'negative_fcf'
  | 'dilution_warning'
  | 'missing_sector'
  | 'recent_run_up'
  | 'unknown_provenance';

export interface TodayCandidateWarning {
  code: TodayCandidateWarningCode;
  label: string;
}

export interface TodayCandidateOwnershipBadge {
  kind: 'watchlist' | 'portfolio' | 'thesis';
  label: string;
  href: string;
}

export type TodayCandidateChangeField =
  | 'rank'
  | 'growth'
  | 'health'
  | 'coverage'
  | 'mandate'
  | 'catalyst';

export interface TodayCandidateInlineChange {
  field: TodayCandidateChangeField;
  label: string;
  previousValue: string;
  currentValue: string;
}

export interface TodayCatalystSummaryInput {
  eventKind: string | null;
  sourceKind: string | null;
  materiality: string;
  direction: string | null;
  novelty: string | null;
  thesisRelevance: string | null;
}

export interface TodayCatalystSummary {
  headline: string;
  assessment: string;
  sourceLabel: string;
  eventLabel: string;
}

export interface TodayCandidate {
  decisionId: number;
  ticker: string;
  companyName: string | null;
  rank: number | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  supportedCriteriaCount: number;
  mandateRelevance: string;
  catalystStatus: string;
  catalystEvidenceStatus: string;
  catalystTier: number | null;
  catalystMateriality: string;
  catalystEventKind: string | null;
  catalystSourceKind: string | null;
  catalystDirection: string | null;
  catalystNovelty: string | null;
  catalystThesisRelevance: string | null;
  catalystEvidenceFreshness: string | null;
  catalystLinkedPeriodEnd: string | null;
  catalystDetail: string | null;
  catalystAt: string | null;
  catalystUrl: string | null;
  lookupBucket: string;
  sourcePathLabel: string;
  provenanceKnown: boolean;
  currentCollectionConfirmed: boolean;
  decisionPrice: number | null;
  priceCapturedAt: string | null;
  currency: string | null;
  priceContext: CandidatePriceContext;
  scenarioValuation: ScenarioValuation;
  reasons: string[];
  risks: string[];
  unknowns: string[];
  warnings: TodayCandidateWarning[];
  researchSummary: TodayCandidateResearchSummary;
  rankComparisonToNext: RklbAdjacentRankExplanation | null;
  ownershipBadges: TodayCandidateOwnershipBadge[];
  inlineChanges: TodayCandidateInlineChange[];
  catalystSummary: TodayCatalystSummary;
  insiderEvidence: TodayInsiderEvidence | null;
}

export type TodayCandidatePriority = 'review_first' | 'promising' | 'watch' | 'low_priority';

export interface TodayCandidateResearchSummary {
  headline: string;
  reasonBullets: string[];
  riskBullets: string[];
  priority: TodayCandidatePriority;
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
  repeated: TodayRepeatedCandidateChange[];
}

export interface TodayRepeatedCandidateChange {
  ticker: string;
  previousRank: number | null;
  currentRank: number | null;
  rankChange: number | null;
  previousGrowthScore: number | null;
  currentGrowthScore: number | null;
  growthScoreChange: number | null;
  previousHealthScore: number | null;
  currentHealthScore: number | null;
  healthScoreChange: number | null;
  previousCoverageScore: number;
  currentCoverageScore: number;
  coverageScoreChange: number;
  previousMandateRelevance: string;
  currentMandateRelevance: string;
  mandateChanged: boolean;
  previousCatalystStatus: string;
  currentCatalystStatus: string;
  catalystChanged: boolean;
  changedFields: TodayCandidateInlineChange[];
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

function stringArray(value: unknown): string[] {
  return arrayValue(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function supportedCriteriaCount(value: unknown): number {
  return countSupportedRankingCriteria(arrayValue(value).map((item) => ({
    id: String(objectValue(item).id || ''),
    status: String(objectValue(item).status || ''),
  })));
}

function candidateRankFactors(candidate: TodayCandidate): RklbRankFactors {
  return {
    ticker: candidate.ticker,
    supportedCriteriaCount: candidate.supportedCriteriaCount,
    catalystTier: candidate.catalystTier,
    growthScore: candidate.growthScore,
    coverageScore: candidate.coverageScore,
    healthScore: candidate.healthScore,
  };
}

function thesisStatusLabel(status: string): string {
  if (status === 'ready') return 'ready';
  if (status === 'researching') return 'researching';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

function changeValue(value: number | null, prefix = ''): string {
  return value == null ? 'unknown' : `${prefix}${value}`;
}

function mandateChangeValue(value: string): string {
  if (value === 'fits') return 'Fits mandate';
  if (value === 'partial') return 'Partial mandate fit';
  if (value === 'not_relevant') return 'Off mandate';
  return value === 'unknown' ? 'Unknown' : value.replaceAll('_', ' ');
}

function changedCandidateFields(change: Omit<TodayRepeatedCandidateChange, 'changedFields'>): TodayCandidateInlineChange[] {
  const fields: TodayCandidateInlineChange[] = [];
  if (change.previousRank !== change.currentRank) {
    fields.push({
      field: 'rank', label: 'Rank',
      previousValue: changeValue(change.previousRank, '#'),
      currentValue: changeValue(change.currentRank, '#'),
    });
  }
  if (change.previousGrowthScore !== change.currentGrowthScore) {
    fields.push({
      field: 'growth', label: 'Fundamental Growth',
      previousValue: changeValue(change.previousGrowthScore),
      currentValue: changeValue(change.currentGrowthScore),
    });
  }
  if (change.previousHealthScore !== change.currentHealthScore) {
    fields.push({
      field: 'health', label: 'Financial Health',
      previousValue: changeValue(change.previousHealthScore),
      currentValue: changeValue(change.currentHealthScore),
    });
  }
  if (change.previousCoverageScore !== change.currentCoverageScore) {
    fields.push({
      field: 'coverage', label: 'Coverage',
      previousValue: String(change.previousCoverageScore),
      currentValue: String(change.currentCoverageScore),
    });
  }
  if (change.mandateChanged) {
    fields.push({
      field: 'mandate', label: 'Mandate',
      previousValue: mandateChangeValue(change.previousMandateRelevance),
      currentValue: mandateChangeValue(change.currentMandateRelevance),
    });
  }
  if (change.catalystChanged) {
    fields.push({
      field: 'catalyst', label: 'Catalyst evidence',
      previousValue: getCatalystStatusLabel(change.previousCatalystStatus),
      currentValue: getCatalystStatusLabel(change.currentCatalystStatus),
    });
  }
  return fields;
}

interface ScoreSourceInput {
  metric: string;
  latestFactId: number | null;
  latestPeriodEnd: string | null;
  latestValue: number | null;
}

interface FinancialFactMetadata {
  periodKind: ValuationInputMetric['periodKind'];
  accessionNumber: string | null;
  sourceUrl: string | null;
  derived: boolean;
}

function scoreSources(value: unknown): ScoreSourceInput[] {
  const payload = objectValue(value);
  return arrayValue(payload.sources).flatMap((item) => {
    const source = objectValue(item);
    const metric = typeof source.metric === 'string' ? source.metric : '';
    const latestFactId = numberValue(source.latestFactId);
    const latestValue = numberValue(source.latestValue);
    const latestPeriodEnd = typeof source.latestPeriodEnd === 'string' ? source.latestPeriodEnd : null;
    return metric ? [{ metric, latestFactId, latestPeriodEnd, latestValue }] : [];
  });
}

function scenarioInput(
  row: any,
  facts: Map<number, FinancialFactMetadata>,
): ValuationEvidenceInput {
  const sources = scoreSources(row.score_payload);
  const metric = (name: string): ValuationInputMetric | null => {
    const source = sources.find((item) => item.metric === name);
    if (!source || source.latestFactId == null || source.latestValue == null) return null;
    const metadata = facts.get(source.latestFactId);
    if (!metadata) return null;
    return {
      value: source.latestValue,
      periodEnd: source.latestPeriodEnd,
      periodKind: metadata.periodKind,
      accessionNumber: metadata.accessionNumber,
      sourceUrl: metadata.sourceUrl,
      derived: metadata.derived,
    };
  };
  return {
    marketCap: numberValue(row.market_cap),
    revenue: metric('revenue'),
    netIncome: metric('net_income'),
    freeCashFlow: metric('free_cash_flow'),
    cash: metric('cash'),
    debt: metric('debt'),
  };
}

function scoreDescription(label: string, value: number | null): string | null {
  return value == null ? null : `${label} ${value}`;
}

export function getSourcePathLabel(lookupBucket: string): string {
  if (lookupBucket === 'growth') return 'Growth screen';
  if (lookupBucket === 'recall') return 'Attention recall';
  if (lookupBucket === 'insider') return 'Notable insider purchase';
  if (lookupBucket === 'not_selected') return 'Not selected for market lookup';
  return 'Stored research universe';
}

export function getCatalystStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    supported: 'Supported catalyst',
    material_new_evidence: 'Material new evidence',
    scheduled_only: 'Scheduled event only',
    weak_or_unconfirmed: 'Weak / unconfirmed',
    none_recorded: 'No catalyst recorded',
    unknown: 'Catalyst unknown',
  };
  return labels[status] || status.replaceAll('_', ' ');
}

export function getCatalystMaterialityLabel(materiality: string): string {
  const labels: Record<string, string> = {
    quantified_major: 'Major quantified signal',
    quantified_minor: 'Minor quantified signal',
    unquantified: 'Unquantified signal',
    unknown: 'Materiality unknown',
  };
  return labels[materiality] || materiality.replaceAll('_', ' ');
}

function catalystEventLabel(kind: string | null): string {
  const labels: Record<string, string> = {
    earnings_scheduled: 'scheduled earnings event',
    earnings_disclosed: 'reported earnings',
    sec_filing: 'SEC filing',
    company_release: 'company release',
    news_headline: 'news headline',
  };
  return kind ? labels[kind] || kind.replaceAll('_', ' ') : 'catalyst event';
}

function catalystSourceLabel(kind: string | null): string {
  const labels: Record<string, string> = {
    primary_sec: 'SEC primary source',
    primary_ir: 'company investor-relations source',
    secondary_news: 'secondary news source',
    social: 'social source',
  };
  return kind ? labels[kind] || kind.replaceAll('_', ' ') : 'source not captured';
}

function catalystNoveltyPhrase(value: string | null): string {
  const labels: Record<string, string> = {
    new_information: 'added new information',
    confirms_known: 'confirmed information already known',
    repeat_of_prior_event: 'repeated a previously captured event',
    unknown: 'has unknown novelty',
  };
  return value ? labels[value] || `has ${value.replaceAll('_', ' ')} novelty` : 'has unknown novelty';
}

function catalystDirectionPhrase(value: string | null): string {
  const labels: Record<string, string> = {
    improving: 'improving business evidence',
    deteriorating: 'deteriorating business evidence',
    mixed: 'mixed business evidence',
    unknown: 'unknown business direction',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'unknown business direction';
}

function catalystRelevancePhrase(value: string | null): string {
  const labels: Record<string, string> = {
    decisive: 'directly relevant to the thesis question',
    supporting: 'supporting rather than decisive for the thesis',
    adjacent: 'adjacent to the thesis rather than decisive',
    not_relevant: 'not relevant to the thesis question',
    unknown: 'of unknown thesis relevance',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'of unknown thesis relevance';
}

function catalystMaterialityPhrase(value: string): string {
  const labels: Record<string, string> = {
    quantified_major: 'a major quantified signal',
    quantified_minor: 'a minor quantified signal',
    unquantified: 'an unquantified signal',
    unknown: 'unknown in materiality',
  };
  return labels[value] || value.replaceAll('_', ' ');
}

export function buildHumanCatalystSummary(input: TodayCatalystSummaryInput): TodayCatalystSummary {
  const eventLabel = catalystEventLabel(input.eventKind);
  const sourceLabel = catalystSourceLabel(input.sourceKind);
  const headline = !input.eventKind && !input.sourceKind
    ? 'No specific catalyst event is captured in this brief.'
    : `The ${eventLabel} from the ${sourceLabel} ${catalystNoveltyPhrase(input.novelty)}.`;
  const assessment = `The stored rule assessment calls it ${catalystMaterialityPhrase(input.materiality)}, with ${catalystDirectionPhrase(input.direction)}, and ${catalystRelevancePhrase(input.thesisRelevance)}.`;
  return { headline, assessment, sourceLabel, eventLabel };
}

export function buildCandidateResearchSummary(
  candidate: Omit<TodayCandidate, 'researchSummary'>,
): TodayCandidateResearchSummary {
  const warningCodes = new Set(candidate.warnings.map((warning) => warning.code));
  const reviewFirst = ['not_relevant_mandate', 'negative_fcf', 'dilution_warning', 'low_coverage', 'stale_price']
    .some((code) => warningCodes.has(code as TodayCandidateWarningCode));
  const watch = candidate.lookupBucket === 'recall'
    || warningCodes.has('partial_mandate')
    || warningCodes.has('missing_sector')
    || warningCodes.has('recent_run_up');
  const promising = !reviewFirst
    && !watch
    && (candidate.growthScore ?? 0) >= HIGH_GROWTH_THRESHOLD
    && (candidate.healthScore ?? 0) >= 60
    && candidate.coverageScore >= LOW_COVERAGE_THRESHOLD
    && candidate.mandateRelevance === 'fits';
  const priority: TodayCandidatePriority = reviewFirst
    ? 'review_first'
    : promising ? 'promising' : watch ? 'watch' : 'low_priority';

  const scoreParts = [
    candidate.growthScore == null ? null : `Fundamental Growth ${candidate.growthScore}/100`,
    scoreDescription('Health', candidate.healthScore),
    `Coverage ${candidate.coverageScore}/100`,
  ].filter((value): value is string => Boolean(value));
  const rank = candidate.rank == null ? 'Shortlisted' : `Rank #${candidate.rank}`;
  const riskLabels = candidate.warnings.map((warning) => warning.label);
  if (candidate.lookupBucket === 'recall') {
    riskLabels.push('Entered through attention recall; verify what sustained the attention.');
  }

  let headline: string;
  if (priority === 'review_first') {
    headline = `${rank}: ${scoreParts.join(', ')}, but ${riskLabels[0]?.toLowerCase() || 'the evidence'} needs review before trusting the rank.`;
  } else if (priority === 'promising') {
    headline = `${rank}: ${scoreParts.join(', ')}, mandate fits, and no major candidate-level quality warnings are recorded.`;
  } else if (priority === 'watch') {
    headline = `${rank}: ${scoreParts.join(', ')}. The setup is worth watching, but one or more inputs need a human check.`;
  } else {
    headline = `${rank}: ${scoreParts.join(', ')}. Compare the stored evidence before prioritising deeper research.`;
  }

  const reasonBullets = [
    `${rank} in the latest daily research snapshot.`,
    candidate.growthScore == null ? null : `Fundamental Growth ${candidate.growthScore}/100; Health ${candidate.healthScore ?? 'unknown'}/100.`,
    `Coverage ${candidate.coverageScore}; mandate ${candidate.mandateRelevance === 'fits' ? 'fits' : candidate.mandateRelevance.replaceAll('_', ' ')}.`,
    `${getCatalystStatusLabel(candidate.catalystEvidenceStatus !== 'unknown' ? candidate.catalystEvidenceStatus : candidate.catalystStatus)}.`,
    `Source path: ${candidate.sourcePathLabel}.`,
  ].filter((value): value is string => Boolean(value));

  if ((candidate.catalystStatus === 'supported' || candidate.catalystEvidenceStatus === 'material_new_evidence')
      && !candidate.catalystDetail) {
    reasonBullets.push('Catalyst is classified as supported, but an event description is not available in this brief.');
  }

  return {
    headline,
    reasonBullets,
    riskBullets: riskLabels,
    priority,
  };
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
      marketDataInsider: numberValue(lookup.insider),
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
    repeated: [],
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
       ), latest AS (
         SELECT * FROM canonical_days
         ORDER BY decision_date DESC, run_at DESC, id DESC
         LIMIT 1
       ), selected AS (
         SELECT c.*
         FROM canonical_days c
         CROSS JOIN latest l
         WHERE c.model_version = l.model_version
         ORDER BY c.decision_date DESC, c.run_at DESC, c.id DESC
         LIMIT 2
       )
       SELECT selected.*, (SELECT count(*)::int FROM canonical_days) AS canonical_run_count
       FROM selected
       ORDER BY decision_date DESC, run_at DESC, id DESC
      `,
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
        `SELECT d.id, d.company_id, d.ticker, d.candidate_rank, d.growth_score,
                d.health_score, d.coverage_score, d.decision_price, d.currency,
                d.market_cap, d.score_snapshot_id, s.payload AS score_payload,
                COALESCE(p.market_at, p.captured_at) AS price_captured_at,
                d.catalyst_status, d.catalyst_evidence_status, d.catalyst_evidence_tier,
                d.catalyst_materiality, d.catalyst_mandate_relevance,
                d.catalyst_event_kind, d.catalyst_source_kind, d.catalyst_direction,
                d.catalyst_novelty, d.catalyst_thesis_relevance,
                d.catalyst_evidence_freshness,
                d.catalyst_linked_period_end::text AS catalyst_linked_period_end,
                d.catalyst_detail,
                d.catalyst_at, d.catalyst_url, d.reasons, d.risks, d.unknowns, d.criteria,
                d.sector, d.collection_run_item_id,
                c.name AS company_name, i.lookup_bucket, i.raw_signal,
                COALESCE(i.market_data_found, false) AS current_collection_confirmed
         FROM discovery_decisions d
         LEFT JOIN companies c ON c.id = d.company_id
         LEFT JOIN collection_run_items i ON i.id = d.collection_run_item_id
         LEFT JOIN company_score_snapshots s ON s.id = d.score_snapshot_id
         LEFT JOIN price_snapshots p ON p.id = d.price_snapshot_id AND p.company_id = d.company_id
         WHERE d.run_id = $1 AND d.included = true
         ORDER BY d.candidate_rank NULLS LAST, d.ticker`,
        [latestCanonicalRun.id],
      );
      const companyIds = candidateResult.rows
        .map((row) => numberValue(row.company_id))
        .filter((id): id is number => id != null);
      const candidateTickers = candidateResult.rows.map((row) => String(row.ticker));
      const ownershipByTicker = new Map<string, TodayCandidateOwnershipBadge[]>();
      if (candidateTickers.length > 0) {
        const ownershipResult = await client.query(
          `SELECT p.id AS position_id, p.ticker, p.status AS position_status,
                  t.id AS thesis_id, t.status AS thesis_status, t.created_at AS thesis_created_at
           FROM portfolio_positions p
           LEFT JOIN investment_theses t ON t.position_id = p.id AND t.is_current = true
           WHERE p.ticker = ANY($1::text[])
           ORDER BY p.ticker, t.created_at DESC NULLS LAST, p.updated_at DESC, p.id DESC`,
          [candidateTickers],
        );
        const seenKinds = new Map<string, Set<TodayCandidateOwnershipBadge['kind']>>();
        for (const row of ownershipResult.rows) {
          const ticker = String(row.ticker);
          const badges = ownershipByTicker.get(ticker) || [];
          const seen = seenKinds.get(ticker) || new Set<TodayCandidateOwnershipBadge['kind']>();
          if (row.position_status === 'watch' && !seen.has('watchlist')) {
            badges.push({ kind: 'watchlist', label: 'Watchlist', href: '/watchlist' });
            seen.add('watchlist');
          }
          if (row.position_status === 'active' && !seen.has('portfolio')) {
            badges.push({ kind: 'portfolio', label: 'Portfolio', href: '/portfolio' });
            seen.add('portfolio');
          }
          if (row.thesis_id != null && !seen.has('thesis')) {
            badges.push({
              kind: 'thesis',
              label: `Thesis · ${thesisStatusLabel(String(row.thesis_status || 'draft'))}`,
              href: `/thesis/${Number(row.position_id)}`,
            });
            seen.add('thesis');
          }
          ownershipByTicker.set(ticker, badges);
          seenKinds.set(ticker, seen);
        }
      }
      const pricesByCompany = new Map<number, StoredPriceObservation[]>();
      if (companyIds.length > 0) {
        const priceResult = await client.query(
          `SELECT company_id, price, captured_at
           FROM price_snapshots
           WHERE company_id = ANY($1::bigint[])
             AND price IS NOT NULL
             AND captured_at <= $2::timestamptz
             AND captured_at >= $2::timestamptz - interval '380 days'
           ORDER BY company_id, captured_at`,
          [companyIds, latestCanonicalRun.runAt],
        );
        for (const row of priceResult.rows) {
          const companyId = Number(row.company_id);
          const observations = pricesByCompany.get(companyId) || [];
          observations.push({ price: Number(row.price), capturedAt: new Date(row.captured_at).toISOString() });
          pricesByCompany.set(companyId, observations);
        }
      }

      const factIds = [...new Set(candidateResult.rows.flatMap((row) => (
        scoreSources(row.score_payload)
          .map((source) => source.latestFactId)
          .filter((id): id is number => id != null)
      )))];
      const factMetadata = new Map<number, FinancialFactMetadata>();
      if (factIds.length > 0) {
        const factResult = await client.query(
          `SELECT id, period_kind, accession_number, source_url, is_derived
           FROM financial_facts
           WHERE id = ANY($1::bigint[])`,
          [factIds],
        );
        for (const row of factResult.rows) {
          factMetadata.set(Number(row.id), {
            periodKind: row.period_kind || null,
            accessionNumber: row.accession_number || null,
            sourceUrl: row.source_url || null,
            derived: Boolean(row.is_derived),
          });
        }
      }

      topCandidates = candidateResult.rows.map((row) => {
        const lookupBucket = row.lookup_bucket || 'unknown';
        const decisionPrice = numberValue(row.decision_price);
        const companyId = numberValue(row.company_id);
        const priceContext = buildPriceContext({
          asOf: latestCanonicalRun.runAt,
          currentPrice: decisionPrice,
          observations: companyId == null ? [] : pricesByCompany.get(companyId) || [],
        });
        const warnings = candidateWarnings(row, qualityMetrics);
        const priceCapturedAt = row.price_captured_at ? new Date(row.price_captured_at).toISOString() : null;
        if (priceObservationRecency(priceCapturedAt, latestCanonicalRun.runAt) === 'stale') {
          warnings.push({ code: 'stale_price', label: 'Stale decision price; current setup unknown' });
        }
        if (priceContext.recentRunUp) {
          warnings.push({ code: 'recent_run_up', label: 'Recent run-up; review entry price' });
        }
        const candidate: Omit<TodayCandidate, 'researchSummary'> = {
          decisionId: Number(row.id),
          ticker: String(row.ticker),
          companyName: row.company_name || null,
          rank: numberValue(row.candidate_rank),
          growthScore: numberValue(row.growth_score),
          healthScore: numberValue(row.health_score),
          coverageScore: Number(row.coverage_score),
          supportedCriteriaCount: supportedCriteriaCount(row.criteria),
          mandateRelevance: row.catalyst_mandate_relevance || 'unknown',
          catalystStatus: row.catalyst_status || 'unknown',
          catalystEvidenceStatus: row.catalyst_evidence_status || 'unknown',
          catalystTier: numberValue(row.catalyst_evidence_tier),
          catalystMateriality: row.catalyst_materiality || 'unknown',
          catalystEventKind: row.catalyst_event_kind || null,
          catalystSourceKind: row.catalyst_source_kind || null,
          catalystDirection: row.catalyst_direction || null,
          catalystNovelty: row.catalyst_novelty || null,
          catalystThesisRelevance: row.catalyst_thesis_relevance || null,
          catalystEvidenceFreshness: row.catalyst_evidence_freshness || null,
          catalystLinkedPeriodEnd: row.catalyst_linked_period_end
            ? toDateOnly(row.catalyst_linked_period_end) : null,
          catalystDetail: row.catalyst_detail?.trim() || null,
          catalystAt: row.catalyst_at ? new Date(row.catalyst_at).toISOString() : null,
          catalystUrl: row.catalyst_url || null,
          lookupBucket,
          sourcePathLabel: getSourcePathLabel(lookupBucket),
          provenanceKnown: Boolean(row.collection_run_item_id && row.lookup_bucket && row.lookup_bucket !== 'unknown'),
          currentCollectionConfirmed: Boolean(row.current_collection_confirmed),
          decisionPrice,
          priceCapturedAt,
          currency: row.currency || null,
          priceContext,
          scenarioValuation: buildScenarioValuation(
            scenarioInput(row, factMetadata),
            decisionPrice,
            new Date(latestCanonicalRun.runAt),
          ),
          reasons: stringArray(row.reasons),
          risks: stringArray(row.risks),
          unknowns: stringArray(row.unknowns),
          warnings,
          rankComparisonToNext: null,
          ownershipBadges: ownershipByTicker.get(String(row.ticker)) || [],
          inlineChanges: [],
          catalystSummary: buildHumanCatalystSummary({
            eventKind: row.catalyst_event_kind || null,
            sourceKind: row.catalyst_source_kind || null,
            materiality: row.catalyst_materiality || 'unknown',
            direction: row.catalyst_direction || null,
            novelty: row.catalyst_novelty || null,
            thesisRelevance: row.catalyst_thesis_relevance || null,
          }),
          insiderEvidence: parseTodayInsiderEvidence(row.raw_signal),
        };
        return { ...candidate, researchSummary: buildCandidateResearchSummary(candidate) };
      });
      topCandidates = topCandidates.map((candidate, index) => {
        const next = topCandidates[index + 1];
        return {
          ...candidate,
          rankComparisonToNext: next
            ? explainAdjacentRklbRanks(candidateRankFactors(candidate), candidateRankFactors(next))
            : null,
        };
      });
    }

    let changes = emptyChanges();
    if (latestCanonicalRun && previousCanonicalRun) {
      const changeResult = await client.query(
        `SELECT run_id, ticker, candidate_rank, growth_score, health_score, coverage_score,
                catalyst_mandate_relevance, catalyst_evidence_status, catalyst_status
         FROM discovery_decisions
         WHERE included = true AND run_id = ANY($1::bigint[])
         ORDER BY run_id, ticker`,
        [[latestCanonicalRun.id, previousCanonicalRun.id]],
      );
      const latestRows = new Map<string, any>();
      const previousRows = new Map<string, any>();
      for (const row of changeResult.rows) {
        const target = Number(row.run_id) === latestCanonicalRun.id ? latestRows : previousRows;
        target.set(String(row.ticker), row);
      }
      const latestTickers = new Set(latestRows.keys());
      const previousTickers = new Set(previousRows.keys());
      const repeatedTickers = [...latestTickers].filter((ticker) => previousTickers.has(ticker)).sort();
      changes = {
        available: true,
        previousRunId: previousCanonicalRun.id,
        previousDecisionDate: previousCanonicalRun.decisionDate,
        modelVersionChanged: previousCanonicalRun.modelVersion !== latestCanonicalRun.modelVersion,
        newIncludedTickers: [...latestTickers].filter((ticker) => !previousTickers.has(ticker)).sort(),
        removedTickers: [...previousTickers].filter((ticker) => !latestTickers.has(ticker)).sort(),
        repeatedTickers,
        repeated: repeatedTickers.map((ticker) => {
          const previous = previousRows.get(ticker);
          const current = latestRows.get(ticker);
          const previousRank = numberValue(previous.candidate_rank);
          const currentRank = numberValue(current.candidate_rank);
          const previousGrowthScore = numberValue(previous.growth_score);
          const currentGrowthScore = numberValue(current.growth_score);
          const previousHealthScore = numberValue(previous.health_score);
          const currentHealthScore = numberValue(current.health_score);
          const previousCoverageScore = Number(previous.coverage_score);
          const currentCoverageScore = Number(current.coverage_score);
          const previousMandateRelevance = previous.catalyst_mandate_relevance || 'unknown';
          const currentMandateRelevance = current.catalyst_mandate_relevance || 'unknown';
          const previousCatalystStatus = previous.catalyst_evidence_status || previous.catalyst_status || 'unknown';
          const currentCatalystStatus = current.catalyst_evidence_status || current.catalyst_status || 'unknown';
          const change = {
            ticker,
            previousRank,
            currentRank,
            rankChange: previousRank == null || currentRank == null ? null : previousRank - currentRank,
            previousGrowthScore,
            currentGrowthScore,
            growthScoreChange: previousGrowthScore == null || currentGrowthScore == null
              ? null : currentGrowthScore - previousGrowthScore,
            previousHealthScore,
            currentHealthScore,
            healthScoreChange: previousHealthScore == null || currentHealthScore == null
              ? null : currentHealthScore - previousHealthScore,
            previousCoverageScore,
            currentCoverageScore,
            coverageScoreChange: currentCoverageScore - previousCoverageScore,
            previousMandateRelevance,
            currentMandateRelevance,
            mandateChanged: previousMandateRelevance !== currentMandateRelevance,
            previousCatalystStatus,
            currentCatalystStatus,
            catalystChanged: previousCatalystStatus !== currentCatalystStatus,
          };
          return { ...change, changedFields: changedCandidateFields(change) };
        }),
      };
    }
    const changesByTicker = new Map(changes.repeated.map((change) => [change.ticker, change.changedFields]));
    topCandidates = topCandidates.map((candidate) => ({
      ...candidate,
      inlineChanges: changesByTicker.get(candidate.ticker) || [],
    }));

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
        message: `No daily research snapshot exists for Tallinn date ${todayTallinnDate}.`,
      });
    }
    if (!latestCanonicalRun) {
      warnings.push({
        code: 'canonical_history_empty',
        severity: 'critical',
        message: 'Daily research snapshot history is empty.',
      });
    } else if (!dataQuality) {
      warnings.push({
        code: 'data_quality_snapshot_missing',
        severity: 'warning',
        message: `Daily research snapshot #${latestCanonicalRun.id} has no data-quality snapshot.`,
      });
    }
    if (latestCollectionRun?.status === 'failure') {
      warnings.push({
        code: 'latest_collection_failed',
        severity: 'critical',
        message: `Latest collection run #${latestCollectionRun.id} failed.`,
      });
    }
    if (latestCanonicalRun) {
      warnings.push({
        code: 'canonical_input_change_unknown',
        severity: 'info',
        message: 'Whether inputs changed after this snapshot was captured is not stored historically.',
      });
    }
    if (!missedMovesSummary.available) {
      warnings.push({
        code: 'missed_moves_unavailable',
        severity: 'info',
        message: 'The missed-move summary is unavailable in this brief.',
      });
    }
    if (changes.modelVersionChanged) {
      warnings.push({
        code: 'model_version_changed',
        severity: 'warning',
        message: 'The latest two daily snapshots use different model versions; compare ticker changes cautiously.',
      });
    }

    const watchItems: TodayWatchItem[] = [];
    if (!hasTodayCanonicalRun) {
      watchItems.push({
        code: 'today_canonical_missing', severity: 'warning', ticker: null,
        title: "Today's daily snapshot is missing",
        detail: "Check the collection log and do not treat yesterday's shortlist as today's fresh result.",
        href: null,
      });
    }
    if (latestCollectionRun?.status === 'failure') {
      watchItems.push({
        code: 'latest_collection_failed', severity: 'critical', ticker: null,
        title: `Collection run #${latestCollectionRun.id} failed`,
        detail: latestCollectionRun.errorMessage || 'No error message was stored; inspect system details.',
        href: null,
      });
    }
    for (const candidate of topCandidates) {
      if (candidate.mandateRelevance === 'not_relevant') {
        watchItems.push({
          code: 'not_relevant_mandate', severity: 'critical', ticker: candidate.ticker,
          title: `${candidate.ticker}: included but off mandate`,
          detail: 'Review why it ranked and whether it fits the research mandate before trusting the shortlist position.',
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if ((candidate.growthScore ?? 0) >= HIGH_GROWTH_THRESHOLD
          && candidate.coverageScore < LOW_COVERAGE_THRESHOLD) {
        watchItems.push({
          code: 'high_score_low_coverage', severity: 'warning', ticker: candidate.ticker,
          title: `${candidate.ticker}: strong Fundamental Growth, low coverage`,
          detail: `Fundamental Growth ${candidate.growthScore}/100, coverage ${candidate.coverageScore}/100. Check the missing score inputs.`,
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if (candidate.mandateRelevance === 'partial') {
        watchItems.push({
          code: 'partial_mandate', severity: 'warning', ticker: candidate.ticker,
          title: `${candidate.ticker}: partial mandate fit`,
          detail: 'Clarify which part of the research mandate it meets before spending more time.',
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      for (const warning of candidate.warnings.filter((item) => (
        item.code === 'negative_fcf' || item.code === 'dilution_warning' || item.code === 'missing_sector' || item.code === 'stale_price'
      ))) {
        watchItems.push({
          code: warning.code,
          severity: warning.code === 'missing_sector' ? 'warning' : 'critical',
          ticker: candidate.ticker,
          title: `${candidate.ticker}: ${warning.label}`,
          detail: warning.code === 'stale_price'
            ? `Decision price observed at ${candidate.priceCapturedAt}; obtain a recent quote before assessing the current setup.`
            : warning.code === 'missing_sector'
            ? 'Peer and sector-relative context may be incomplete.'
            : 'Treat this as a core risk to verify in the stored filing evidence.',
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if (candidate.lookupBucket === 'recall') {
        watchItems.push({
          code: 'recall_candidate', severity: 'warning', ticker: candidate.ticker,
          title: `${candidate.ticker}: Attention recall`,
          detail: 'It entered through sustained absolute attention rather than mention growth; verify what kept attention elevated.',
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
      if (candidate.priceContext.recentRunUp) {
        watchItems.push({
          code: 'recent_run_up', severity: 'warning', ticker: candidate.ticker,
          title: `${candidate.ticker}: recent price run-up`,
          detail: `${candidate.priceContext.recentRunUpReasons.join('; ')}. Strong fundamentals do not by themselves make today's entry price attractive.`,
          href: `/company/${encodeURIComponent(candidate.ticker)}`,
        });
      }
    }
    for (const move of missedMovesSummary.recent.filter((item) => item.priorCoverage === 'universe_gap')) {
      watchItems.push({
        code: 'missed_move_universe_gap', severity: 'warning', ticker: move.ticker,
        title: `${move.ticker}: missed-move universe gap`,
        detail: `${move.changePercent >= 0 ? '+' : ''}${move.changePercent.toFixed(1)}% ${move.previousDate} → ${move.observedDate}; it was outside the stored research universe before the move.`,
        href: '/missed-moves',
      });
    }

    const hasCandidateReview = topCandidates.some((candidate) => (
      candidate.warnings.length > 0 || candidate.lookupBucket === 'recall'
    ));
    const hasMissedUniverseGap = missedMovesSummary.recent.some((move) => move.priorCoverage === 'universe_gap');
    const status: TodayBriefStatus = latestCollectionRun?.status === 'failure'
      ? 'error'
      : !hasTodayCanonicalRun
        ? 'waiting'
        : latestCollectionRun?.status !== 'success'
          || hasCandidateReview
          || hasMissedUniverseGap
          || changes.modelVersionChanged
          ? 'attention'
          : 'ready';

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
