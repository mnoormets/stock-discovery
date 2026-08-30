import { pool } from './db';
import { getAllStoredCompanyFinancials, type CompanyFinancialSummary } from './company-financials';
import { calculateCompanyScores, getTopScoreReasons, type CompanyScore } from './company-scores';
import { listPositions } from './portfolio';
import { saveCompanyScoreSnapshots } from './score-tracking';
import { getSectorRelativeStatsMap, type SectorRelativeStats } from './sector-relative';
import { calculateDataQuality, type DataQualitySummary } from './data-quality';
import { getCatalystEvidenceMap } from './catalyst-events';
import type { CatalystEvidence } from './catalyst-evidence';
import { buildValuationEvidence, type ValuationEvidenceSummary } from './valuation-evidence';
import {
  CANONICAL_RUN_TYPE,
  recordDiscoveryRun,
  type DiscoveryDecisionInput,
  type DiscoveryRunType,
} from './discovery-validation';
import {
  recordDataQualitySnapshot,
  RequiredDataQualitySnapshotError,
} from './data-quality-snapshots';
import { compareRklbRankFactors, countSupportedRankingCriteria } from './rklb-ranking';
import { selectCanonicalCandidatesByMarketCapTier } from './market-cap-tiers';
import {
  MARKET_CAP_TIER_CANDIDATES_PER_TIER,
  MARKET_CAP_TIER_POLICY_VERSION,
} from './config';

export type DiscoveryCriterionStatus = 'supported' | 'uncertain' | 'missing';

export interface DiscoveryCriterion {
  id: 'scale' | 'growth' | 'coverage' | 'runway' | 'catalyst';
  label: string;
  status: DiscoveryCriterionStatus;
  detail: string;
}

export interface RklbCandidate {
  ticker: string;
  name: string | null;
  positionId: number | null;
  price: number | null;
  currency: string | null;
  marketCap: number | null;
  volume: number | null;
  growthScore: number;
  healthScore: number | null;
  coverageScore: number;
  scoreVersion: string | null;
  scoreSnapshotId: number | null;
  criteria: DiscoveryCriterion[];
  reasons: string[];
  risks: string[];
  unknowns: string[];
  proofQuestions: string[];
  catalystAt: string | null;
  sectorRelative: SectorRelativeStats;
  dataQuality: DataQualitySummary;
  catalystEvidence: CatalystEvidence;
  valuationEvidence: ValuationEvidenceSummary;
}

export interface RklbDiscoveryResult {
  candidates: RklbCandidate[];
  evaluatedCompanies: number;
  recordedEvaluatedCompanies: number;
  recordedCandidateCount: number;
  generatedAt: string;
  rules: string[];
  runId: number;
  collectionRunId: number | null;
  runReused: boolean;
  inputChangedAfterCanonicalSnapshot: boolean;
}

interface MarketEvidence {
  companyId: number;
  ticker: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  marketCap: number | null;
  volume: number | null;
  priceSnapshotId: number | null;
  scoreVersion: string | null;
  scoreSnapshotId: number | null;
}

interface EvaluatedCompany {
  financials: CompanyFinancialSummary;
  evidence: MarketEvidence;
  growth: CompanyScore | null;
  health: CompanyScore | null;
  coverage: number;
  criteria: DiscoveryCriterion[];
  catalystEvidence: CatalystEvidence;
  reasons: string[];
  risks: string[];
  unknowns: string[];
  proofQuestions: string[];
  exclusionReasons: string[];
  sectorRelative: SectorRelativeStats;
  dataQuality: DataQualitySummary;
}

const STRONG_SCALE_MAX = 25_000_000_000;
const MICRO_CAP_LIMIT = 100_000_000;
const LOW_VOLUME_LIMIT = 200_000;

const RULES = [
  'Growth vähemalt 65.',
  'Coverage vähemalt 70.',
  `Turukapital jagatakse ${MARKET_CAP_TIER_POLICY_VERSION} järgi lower/middle/upper tier'iks.`,
  'Catalyst ei ole kaasamise eeltingimus: catalyst evidence mõjutab ainult järjestust ja nähtavat tõendit.',
  'Catalyst evidence tier: material_new_evidence > weak_or_unconfirmed > scheduled_only / collection_gap > none_recorded.',
  'Materiaalne uus tõend nõuab primaarallikat, kvantifitseeritud muutust, teadaolevat suunda ja uut infot; pealkiri ega planeeritud kuupäev ei kvalifitseeru.',
  'RKLB ise on võrdlusnäidis ja jäetakse tulemustest välja.',
  `Igast turukapitalitier'ist valitakse kuni ${MARKET_CAP_TIER_CANDIDATES_PER_TIER} kandidaati; vabu kohti ei laenata tier'ide vahel.`,
  'Puuduva või vigase market capiga ettevõte ei saa canonical tier-kohta.',
];

function formatBillions(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('et-EE', { maximumFractionDigits: 1 })} mld`;
  return `${(value / 1_000_000).toLocaleString('et-EE', { maximumFractionDigits: 0 })} mln`;
}

function scaleCriterion(evidence: MarketEvidence): DiscoveryCriterion {
  if (evidence.marketCap == null) return { id: 'scale', label: 'Varajane mastaap', status: 'missing', detail: 'Market cap puudub.' };
  if (evidence.marketCap >= MICRO_CAP_LIMIT && evidence.marketCap <= STRONG_SCALE_MAX) {
    return { id: 'scale', label: 'Varajane mastaap', status: 'supported', detail: `Market cap ${formatBillions(evidence.marketCap)}.` };
  }
  return {
    id: 'scale',
    label: 'Varajane mastaap',
    status: 'uncertain',
    detail: evidence.marketCap < MICRO_CAP_LIMIT
      ? `Market cap ${formatBillions(evidence.marketCap)}; mikrokapi risk vajab kontrolli.`
      : `Market cap ${formatBillions(evidence.marketCap)}; ettevõte pole enam väga varajases faasis.`,
  };
}

function scoreCriterion(id: 'growth' | 'coverage', label: string, score: number | null, supportedAt: number): DiscoveryCriterion {
  if (score == null) return { id, label, status: 'missing', detail: `${label} skoor puudub.` };
  return {
    id,
    label,
    status: score >= supportedAt ? 'supported' : 'uncertain',
    detail: `${label} ${score}/100.`,
  };
}

function runwayCriterion(score: CompanyScore | null): DiscoveryCriterion {
  if (!score) return { id: 'runway', label: 'Finantsiline runway', status: 'missing', detail: 'Financial Health skoor puudub; runway kestust ei saa arvutada.' };
  const cashDebt = score.components.find((component) => component.id === 'cash_debt');
  const cashText = cashDebt ? ` Cash/debt komponent ${cashDebt.score}/100.` : '';
  return {
    id: 'runway',
    label: 'Finantsiline runway',
    status: score.score >= 65 ? 'supported' : 'uncertain',
    detail: `Financial Health ${score.score}/100.${cashText} Kuudes runway'd praegune andmestik ei tõenda.`,
  };
}

// Catalyst ei ole enam hard gate. Kriteerium kuvab ainult tõendi tugevuse:
// supported = materiaalne uus tõend, uncertain = nõrk või ainult planeeritud
// kuupäev, missing = kogumislünk või salvestatud sündmuse puudumine.
function catalystCriterion(evidence: CatalystEvidence): DiscoveryCriterion {
  return { id: 'catalyst', label: 'Catalyst evidence', status: evidence.criterionStatus, detail: evidence.detail };
}

function legacyCatalystType(evidence: CatalystEvidence): string | null {
  const kind = evidence.strongest?.event.kind;
  if (!kind) return null;
  if (kind === 'earnings_scheduled') return 'earnings';
  if (kind === 'news_headline') return 'news';
  if (kind === 'company_release') return 'ir';
  return 'sec';
}

function buildRisks(financials: CompanyFinancialSummary, health: CompanyScore | null, evidence: MarketEvidence, coverage: number): string[] {
  const risks: string[] = [];
  if (health && health.score < 40) risks.push(`Financial Health on nõrk (${health.score}/100).`);
  const dilution = health?.components.find((component) => component.id === 'dilution');
  if (dilution && dilution.score < 40) risks.push(`Aktsiate arvu muutus viitab lahjendusriskile: ${dilution.detail}.`);
  const cashDebt = health?.components.find((component) => component.id === 'cash_debt');
  if (cashDebt && cashDebt.score < 40) risks.push(`Cash/debt komponent on nõrk (${cashDebt.score}/100).`);
  if (evidence.marketCap != null && evidence.marketCap < MICRO_CAP_LIMIT) risks.push('Mikrokapi suurus suurendab volatiilsuse ja likviidsuse riski.');
  if (evidence.volume != null && evidence.volume < LOW_VOLUME_LIMIT) risks.push(`Viimane maht ${evidence.volume.toLocaleString('et-EE')} on madal.`);
  if (coverage < 80) risks.push(`Coverage ${coverage}/100 jätab osa finantspildist katmata.`);
  const fcf = financials.metrics.free_cash_flow?.latest.value;
  if (fcf != null && fcf < 0) risks.push('Viimane tuletatud free cash flow on negatiivne.');
  return risks.length ? risks : ['Praegused reeglid ei leidnud tugevat üksikriski; algallikad vajavad siiski kontrolli.'];
}

function buildUnknowns(
  financials: CompanyFinancialSummary,
  evidence: MarketEvidence,
  growth: CompanyScore | null,
  health: CompanyScore | null,
  catalystUnknowns: string[] = [],
): string[] {
  const unknowns: string[] = [...catalystUnknowns];
  if (evidence.marketCap == null) unknowns.push('Market cap puudub.');
  if (evidence.volume == null) unknowns.push('Kauplemismaht puudub.');
  if (!growth) unknowns.push('Growth skoor puudub.');
  if (!health) unknowns.push('Financial Health skoor puudub.');
  if (growth && growth.coveragePercent < 100) unknowns.push(`Growthi sisendikate on ${growth.coveragePercent}%.`);
  if (health && health.coveragePercent < 100) unknowns.push(`Financial Healthi sisendikate on ${health.coveragePercent}%.`);
  if (!financials.metrics.cash || !financials.metrics.debt) unknowns.push('Cash/debt täielik võrdlus puudub.');
  return unknowns.length ? unknowns : ['Automaatsed põhisisesendid on olemas; kvalitatiivsed väited jäävad endiselt tõendamata.'];
}

async function marketEvidence(): Promise<Map<string, MarketEvidence>> {
  const result = await pool.query(`
    SELECT c.id AS company_id, c.ticker, c.name,
      price.id AS price_snapshot_id, price.price, price.currency, price.market_cap, price.volume,
      score.scoring_version, score.id AS score_snapshot_id
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT p.id, p.price, p.currency, p.market_cap, p.volume
      FROM price_snapshots p WHERE p.company_id = c.id
      ORDER BY p.captured_at DESC, p.id DESC LIMIT 1
    ) price ON true
    LEFT JOIN LATERAL (
      SELECT s.id, s.scoring_version FROM company_score_snapshots s
      WHERE s.company_id = c.id ORDER BY s.calculated_at DESC, s.id DESC LIMIT 1
    ) score ON true
  `);
  return new Map(result.rows.map((row) => [row.ticker, {
    companyId: Number(row.company_id), ticker: row.ticker, name: row.name || null,
    price: row.price == null ? null : Number(row.price), currency: row.currency || null,
    marketCap: row.market_cap == null ? null : Number(row.market_cap),
    volume: row.volume == null ? null : Number(row.volume),
    priceSnapshotId: row.price_snapshot_id == null ? null : Number(row.price_snapshot_id),
    scoreVersion: row.scoring_version || null,
    scoreSnapshotId: row.score_snapshot_id == null ? null : Number(row.score_snapshot_id),
  }]));
}

// Järjestus jääb leksikograafiline ja koondskoorita. Catalyst evidence tier on
// üks aste, mitte kaalutud punkt ega kaasamisfilter.
function candidateOrder(a: EvaluatedCompany, b: EvaluatedCompany): number {
  const supportedA = countSupportedRankingCriteria(a.criteria);
  const supportedB = countSupportedRankingCriteria(b.criteria);
  return compareRklbRankFactors({
    ticker: a.evidence.ticker,
    supportedCriteriaCount: supportedA,
    catalystTier: a.catalystEvidence.tier,
    growthScore: a.growth?.score ?? null,
    coverageScore: a.coverage,
    healthScore: a.health?.score ?? null,
  }, {
    ticker: b.evidence.ticker,
    supportedCriteriaCount: supportedB,
    catalystTier: b.catalystEvidence.tier,
    growthScore: b.growth?.score ?? null,
    coverageScore: b.coverage,
    healthScore: b.health?.score ?? null,
  });
}

function decisionInput(item: EvaluatedCompany, included: boolean, rank: number | null): DiscoveryDecisionInput {
  const runway = item.criteria.find((criterion) => criterion.id === 'runway')!;
  return {
    companyId: item.evidence.companyId,
    ticker: item.evidence.ticker,
    included,
    candidateRank: rank,
    exclusionReasons: included ? [] : item.exclusionReasons,
    growthScore: item.growth?.score ?? null,
    healthScore: item.health?.score ?? null,
    coverageScore: item.coverage,
    decisionPrice: item.evidence.price,
    currency: item.evidence.currency,
    marketCap: item.evidence.marketCap,
    volume: item.evidence.volume,
    priceSnapshotId: item.evidence.priceSnapshotId,
    scoreSnapshotId: item.evidence.scoreSnapshotId,
    scoringVersion: item.evidence.scoreVersion,
    runwayStatus: runway.status,
    runwayDetail: runway.detail,
    catalystStatus: item.catalystEvidence.criterionStatus,
    catalystType: legacyCatalystType(item.catalystEvidence),
    catalystSourceId: item.catalystEvidence.strongest?.event.sourceRef ?? null,
    catalystUrl: item.catalystEvidence.strongest?.event.url ?? null,
    catalystAt: item.catalystEvidence.strongest?.event.occurredAt ?? null,
    catalystDetail: item.catalystEvidence.detail,
    catalystAssessmentVersion: item.catalystEvidence.version,
    catalystEvidenceStatus: item.catalystEvidence.status,
    catalystEvidenceTier: item.catalystEvidence.tier,
    catalystEventKind: item.catalystEvidence.strongest?.event.kind ?? null,
    catalystSourceKind: item.catalystEvidence.strongest?.assessment.sourceQuality ?? null,
    catalystMateriality: item.catalystEvidence.strongest?.assessment.materiality ?? null,
    catalystMaterialityRatio: item.catalystEvidence.strongest?.assessment.materialityRatio ?? null,
    catalystDirection: item.catalystEvidence.strongest?.assessment.direction ?? null,
    catalystNovelty: item.catalystEvidence.strongest?.assessment.novelty ?? null,
    catalystThesisRelevance: item.catalystEvidence.strongest?.assessment.thesisRelevance ?? null,
    catalystMandateRelevance: item.catalystEvidence.strongest?.assessment.mandateRelevance ?? null,
    catalystEvidenceFreshness: item.catalystEvidence.strongest?.assessment.evidenceFreshness ?? null,
    catalystEventId: item.catalystEvidence.strongest?.event.id ?? null,
    catalystLinkedPeriodEnd: item.catalystEvidence.strongest?.event.linkedPeriodEnd ?? null,
    catalystNextScheduledAt: item.catalystEvidence.nextScheduledAt,
    risks: item.risks,
    unknowns: item.unknowns,
    reasons: included ? item.reasons : [],
    criteria: item.criteria,
    proofQuestions: item.proofQuestions,
    sector: item.sectorRelative.sector,
    industry: item.sectorRelative.industry,
    sectorGroupType: item.sectorRelative.groupType,
    sectorGrowthPercentile: item.sectorRelative.growth.percentile,
    sectorHealthPercentile: item.sectorRelative.health.percentile,
    sectorCoveragePercentile: item.sectorRelative.coverage.percentile,
    sectorMarketCapPercentile: item.sectorRelative.marketCap.percentile,
    sectorComparableCount: item.sectorRelative.status === 'unknown' ? null : item.sectorRelative.comparableCount,
    sectorMedianGrowth: item.sectorRelative.growth.median,
    sectorMedianHealth: item.sectorRelative.health.median,
    sectorMedianCoverage: item.sectorRelative.coverage.median,
  };
}

export async function getRklbDiscoveryCandidates(
  options: { runType?: DiscoveryRunType; collectionRunId?: number | null } = {},
): Promise<RklbDiscoveryResult> {
  const financials = await getAllStoredCompanyFinancials();
  await saveCompanyScoreSnapshots(financials);
  const [evidenceByTicker, positions, sectorRelativeByTicker] = await Promise.all([
    marketEvidence(),
    listPositions(),
    getSectorRelativeStatsMap(financials.map((financial) => financial.ticker)),
  ]);
  const positionByTicker = new Map(positions.filter((position) => position.status !== 'closed').map((position) => [position.ticker, position.id]));
  const runAt = new Date();
  const scored = financials.flatMap((financial) => {
    const evidence = evidenceByTicker.get(financial.ticker);
    const sectorRelative = sectorRelativeByTicker.get(financial.ticker);
    if (!evidence || !sectorRelative) return [];
    return [{
      financial,
      evidence,
      sectorRelative,
      scores: calculateCompanyScores(financial),
      dataQuality: calculateDataQuality(financial, runAt),
    }];
  });
  const catalystByTicker = await getCatalystEvidenceMap(scored.map((item) => ({
    companyId: item.evidence.companyId,
    ticker: item.evidence.ticker,
    financials: item.financial,
    dataQuality: item.dataQuality,
    marketCap: item.evidence.marketCap,
  })), runAt);
  const evaluated: EvaluatedCompany[] = [];

  for (const { financial, evidence, sectorRelative, scores, dataQuality } of scored) {
    const growth = scores.growth;
    const catalystEvidence = catalystByTicker.get(financial.ticker);
    if (!catalystEvidence) continue;
    const criteria = [
      scaleCriterion(evidence),
      scoreCriterion('growth', 'Erakordne kasv', growth?.score ?? null, 80),
      scoreCriterion('coverage', 'Andmekate', scores.coverage.score, 80),
      runwayCriterion(scores.financialHealth),
      catalystCriterion(catalystEvidence),
    ];
    const exclusions: string[] = [];
    if (financial.ticker === 'RKLB') exclusions.push('RKLB on võrdlusnäidis, mitte kandidaat.');
    if (!growth) exclusions.push('Growth skoor puudub.');
    else if (growth.score < 65) exclusions.push(`Growth ${growth.score}/100 jääb alla 65 lävendi.`);
    if (scores.coverage.score < 70) exclusions.push(`Coverage ${scores.coverage.score}/100 jääb alla 70 lävendi.`);
    const topGrowthReasons = getTopScoreReasons(growth, 2);
    evaluated.push({
      financials: financial, evidence, growth, health: scores.financialHealth,
      coverage: scores.coverage.score, criteria, catalystEvidence,
      reasons: growth ? [
        `Growth ${growth.score}/100 ja Coverage ${scores.coverage.score}/100 läbivad baasfiltri.`,
        ...topGrowthReasons.map((reason) => `${reason.label}: ${reason.detail}.`),
        catalystEvidence.detail,
      ] : [],
      risks: buildRisks(financial, scores.financialHealth, evidence, scores.coverage.score),
      unknowns: buildUnknowns(financial, evidence, growth, scores.financialHealth, catalystEvidence.unknowns),
      proofQuestions: [
        'Mis on ettevõtte kaitstav konkurentsieelis ja milline algallikas seda tõendab?',
        'Mida turg praegu valesti hinnastab ning milline vastupidine seletus on võimalik?',
        'Mis peab järgmise 12 kuu jooksul mõõdetavalt juhtuma?',
      ],
      exclusionReasons: exclusions,
      sectorRelative,
      dataQuality,
    });
  }

  const eligible = evaluated.filter((item) => item.exclusionReasons.length === 0);
  const tierSelection = selectCanonicalCandidatesByMarketCapTier(
    eligible,
    (item) => item.evidence.marketCap,
    candidateOrder,
  );
  const selected = [...tierSelection.selected].sort(candidateOrder);
  const selectedRank = new Map(selected.map((item, index) => [item.evidence.ticker, index + 1]));
  for (const item of tierSelection.overCapacity) {
    item.exclusionReasons.push(`Läbis baasfiltrid, kuid jäi oma turukapitalitier'i ${MARKET_CAP_TIER_CANDIDATES_PER_TIER} koha piirist välja.`);
  }
  for (const item of tierSelection.unknownMarketCap) {
    item.exclusionReasons.push('Market cap puudub või on vigane; canonical tier-kohta ei määrata.');
  }
  const decisions = evaluated.map((item) => {
    const rank = selectedRank.get(item.evidence.ticker) ?? null;
    return decisionInput(item, rank != null, rank);
  });
  const runType = options.runType || 'rklb';
  const run = await recordDiscoveryRun(RULES, decisions, runAt, runType, options.collectionRunId ?? null);
  // Canonical run ilma kvaliteedisnapshotita oleks poolik audit trail. Viga
  // propagatsioonib collect:daily sammu (CLI lisab selle errors nimekirja ja
  // lõpetab exit 1-ga), kuid juba committed canonical run jääb alles.
  if (runType === CANONICAL_RUN_TYPE) {
    try {
      await recordDataQualitySnapshot(run.runId);
    } catch (error) {
      throw new RequiredDataQualitySnapshotError(run.runId, error);
    }
  }
  const candidates: RklbCandidate[] = selected.map((item) => ({
    ticker: item.evidence.ticker,
    name: item.evidence.name || item.financials.companyName,
    positionId: positionByTicker.get(item.evidence.ticker) || null,
    price: item.evidence.price,
    currency: item.evidence.currency,
    marketCap: item.evidence.marketCap,
    volume: item.evidence.volume,
    growthScore: item.growth!.score,
    healthScore: item.health?.score ?? null,
    coverageScore: item.coverage,
    scoreVersion: item.evidence.scoreVersion,
    scoreSnapshotId: item.evidence.scoreSnapshotId,
    criteria: item.criteria,
    reasons: item.reasons,
    risks: item.risks,
    unknowns: item.unknowns,
    proofQuestions: item.proofQuestions,
    catalystAt: item.catalystEvidence.strongest?.event.occurredAt ?? null,
    sectorRelative: item.sectorRelative,
    dataQuality: item.dataQuality,
    catalystEvidence: item.catalystEvidence,
    valuationEvidence: buildValuationEvidence(item.financials, item.evidence.marketCap),
  }));

  return {
    candidates,
    evaluatedCompanies: evaluated.length,
    recordedEvaluatedCompanies: run.evaluatedCount,
    recordedCandidateCount: run.includedCount,
    generatedAt: runAt.toISOString(),
    rules: RULES,
    runId: run.runId,
    collectionRunId: run.collectionRunId,
    runReused: !run.created,
    inputChangedAfterCanonicalSnapshot: run.inputChangedAfterCanonicalSnapshot,
  };
}
