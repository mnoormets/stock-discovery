import { pool } from './db';
import { getAllStoredCompanyFinancials, type CompanyFinancialSummary } from './company-financials';
import { calculateCompanyScores, getTopScoreReasons, type CompanyScore } from './company-scores';
import { listPositions } from './portfolio';
import { saveCompanyScoreSnapshots } from './score-tracking';
import { getSectorRelativeStatsMap, type SectorRelativeStats } from './sector-relative';
import {
  recordDiscoveryRun,
  type DiscoveryDecisionInput,
} from './discovery-validation';

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
}

export interface RklbDiscoveryResult {
  candidates: RklbCandidate[];
  evaluatedCompanies: number;
  generatedAt: string;
  rules: string[];
  runId: number;
  runReused: boolean;
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
  earningsId: string | null;
  earningsAt: string | null;
  secId: string | null;
  secForm: string | null;
  secUrl: string | null;
  secAt: string | null;
  newsId: string | null;
  newsTitle: string | null;
  newsUrl: string | null;
  newsAt: string | null;
  scoreVersion: string | null;
  scoreSnapshotId: number | null;
}

interface CatalystResult {
  criterion: DiscoveryCriterion;
  catalystAt: string | null;
  gate: boolean;
  type: 'earnings' | 'sec' | 'news' | null;
  sourceId: string | null;
  url: string | null;
}

interface EvaluatedCompany {
  financials: CompanyFinancialSummary;
  evidence: MarketEvidence;
  growth: CompanyScore | null;
  health: CompanyScore | null;
  coverage: number;
  criteria: DiscoveryCriterion[];
  catalyst: CatalystResult;
  reasons: string[];
  risks: string[];
  unknowns: string[];
  proofQuestions: string[];
  exclusionReasons: string[];
  sectorRelative: SectorRelativeStats;
}

const MAX_KNOWN_MARKET_CAP = 75_000_000_000;
const STRONG_SCALE_MAX = 25_000_000_000;
const MICRO_CAP_LIMIT = 100_000_000;
const LOW_VOLUME_LIMIT = 200_000;
const MAX_CANDIDATES = 5;

const RULES = [
  'Growth vähemalt 65.',
  'Coverage vähemalt 70.',
  'Teadaolev market cap kuni 75 miljardit.',
  'Vähemalt üks katalüsaator: earnings 45 päeva jooksul, SEC sündmus 30 päeva jooksul või uudis 14 päeva jooksul.',
  'RKLB ise on võrdlusnäidis ja jäetakse tulemustest välja.',
  'Maksimaalselt viis kõrgeima reeglipõhise järjestusega kandidaati.',
];

function daysFromNow(value: string | null): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function daysAgo(value: string | null): number | null {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

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

function catalystCriterion(evidence: MarketEvidence): CatalystResult {
  const earningsDays = daysFromNow(evidence.earningsAt);
  if (earningsDays != null && earningsDays >= 0 && earningsDays <= 45) {
    return {
      criterion: { id: 'catalyst', label: 'Lähenev katalüsaator', status: 'supported', detail: `Earnings ${earningsDays === 0 ? 'täna' : `${earningsDays} päeva pärast`}.` },
      catalystAt: evidence.earningsAt, gate: true, type: 'earnings', sourceId: evidence.earningsId, url: null,
    };
  }
  const secDays = daysAgo(evidence.secAt);
  if (secDays != null && secDays >= 0 && secDays <= 30) {
    return {
      criterion: { id: 'catalyst', label: 'Lähenev katalüsaator', status: 'supported', detail: `Uus SEC ${evidence.secForm || 'filing'} ${secDays === 0 ? 'täna' : `${secDays} päeva tagasi`}; mõju vajab lugemist.` },
      catalystAt: evidence.secAt, gate: true, type: 'sec', sourceId: evidence.secId, url: evidence.secUrl,
    };
  }
  const newsDays = daysAgo(evidence.newsAt);
  if (newsDays != null && newsDays >= 0 && newsDays <= 14) {
    return {
      criterion: { id: 'catalyst', label: 'Lähenev katalüsaator', status: 'uncertain', detail: `Hiljutine uudis: ${evidence.newsTitle || 'pealkiri puudub'}.` },
      catalystAt: evidence.newsAt, gate: true, type: 'news', sourceId: evidence.newsId, url: evidence.newsUrl,
    };
  }
  return {
    criterion: { id: 'catalyst', label: 'Lähenev katalüsaator', status: 'missing', detail: '45 päeva earnings’it, 30 päeva SEC sündmust ega 14 päeva uudist ei leitud.' },
    catalystAt: null, gate: false, type: null, sourceId: null, url: null,
  };
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

function buildUnknowns(financials: CompanyFinancialSummary, evidence: MarketEvidence, growth: CompanyScore | null, health: CompanyScore | null): string[] {
  const unknowns: string[] = [];
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
      earnings.id AS earnings_id, earnings.event_at AS earnings_at,
      sec.id AS sec_id, sec.form_type AS sec_form, sec.url AS sec_url, sec.discovered_at AS sec_at,
      news.id AS news_id, news.title AS news_title, news.url AS news_url,
      COALESCE(news.published_at, news.discovered_at) AS news_at,
      score.scoring_version, score.id AS score_snapshot_id
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT p.id, p.price, p.currency, p.market_cap, p.volume
      FROM price_snapshots p WHERE p.company_id = c.id
      ORDER BY p.captured_at DESC, p.id DESC LIMIT 1
    ) price ON true
    LEFT JOIN LATERAL (
      SELECT e.id, e.event_at FROM earnings_events e
      WHERE e.company_id = c.id AND e.event_at >= now() AND e.event_at <= now() + interval '45 days'
      ORDER BY e.event_at ASC LIMIT 1
    ) earnings ON true
    LEFT JOIN LATERAL (
      SELECT s.id, s.form_type, s.url, s.discovered_at FROM sec_events s
      WHERE s.company_id = c.id AND s.discovered_at >= now() - interval '30 days'
      ORDER BY s.discovered_at DESC, s.id DESC LIMIT 1
    ) sec ON true
    LEFT JOIN LATERAL (
      SELECT n.id, n.title, n.url, n.published_at, n.discovered_at FROM news_items n
      WHERE n.company_id = c.id AND COALESCE(n.published_at, n.discovered_at) >= now() - interval '14 days'
      ORDER BY COALESCE(n.published_at, n.discovered_at) DESC, n.id DESC LIMIT 1
    ) news ON true
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
    earningsId: row.earnings_id == null ? null : String(row.earnings_id),
    earningsAt: row.earnings_at ? new Date(row.earnings_at).toISOString() : null,
    secId: row.sec_id == null ? null : String(row.sec_id), secForm: row.sec_form || null,
    secUrl: row.sec_url || null, secAt: row.sec_at ? new Date(row.sec_at).toISOString() : null,
    newsId: row.news_id == null ? null : String(row.news_id), newsTitle: row.news_title || null,
    newsUrl: row.news_url || null, newsAt: row.news_at ? new Date(row.news_at).toISOString() : null,
    scoreVersion: row.scoring_version || null,
    scoreSnapshotId: row.score_snapshot_id == null ? null : Number(row.score_snapshot_id),
  }]));
}

function candidateOrder(a: EvaluatedCompany, b: EvaluatedCompany): number {
  const supportedA = a.criteria.filter((criterion) => criterion.status === 'supported').length;
  const supportedB = b.criteria.filter((criterion) => criterion.status === 'supported').length;
  return supportedB - supportedA
    || (b.growth?.score ?? -1) - (a.growth?.score ?? -1)
    || b.coverage - a.coverage
    || (b.health?.score ?? -1) - (a.health?.score ?? -1)
    || a.evidence.ticker.localeCompare(b.evidence.ticker);
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
    catalystStatus: item.catalyst.criterion.status,
    catalystType: item.catalyst.type,
    catalystSourceId: item.catalyst.sourceId,
    catalystUrl: item.catalyst.url,
    catalystAt: item.catalyst.catalystAt,
    catalystDetail: item.catalyst.criterion.detail,
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

export async function getRklbDiscoveryCandidates(): Promise<RklbDiscoveryResult> {
  const financials = await getAllStoredCompanyFinancials();
  await saveCompanyScoreSnapshots(financials);
  const [evidenceByTicker, positions, sectorRelativeByTicker] = await Promise.all([
    marketEvidence(),
    listPositions(),
    getSectorRelativeStatsMap(financials.map((financial) => financial.ticker)),
  ]);
  const positionByTicker = new Map(positions.filter((position) => position.status !== 'closed').map((position) => [position.ticker, position.id]));
  const evaluated: EvaluatedCompany[] = [];

  for (const financial of financials) {
    const evidence = evidenceByTicker.get(financial.ticker);
    if (!evidence) continue;
    const sectorRelative = sectorRelativeByTicker.get(financial.ticker);
    if (!sectorRelative) continue;
    const scores = calculateCompanyScores(financial);
    const growth = scores.growth;
    const catalyst = catalystCriterion(evidence);
    const criteria = [
      scaleCriterion(evidence),
      scoreCriterion('growth', 'Erakordne kasv', growth?.score ?? null, 80),
      scoreCriterion('coverage', 'Andmekate', scores.coverage.score, 80),
      runwayCriterion(scores.financialHealth),
      catalyst.criterion,
    ];
    const exclusions: string[] = [];
    if (financial.ticker === 'RKLB') exclusions.push('RKLB on võrdlusnäidis, mitte kandidaat.');
    if (!growth) exclusions.push('Growth skoor puudub.');
    else if (growth.score < 65) exclusions.push(`Growth ${growth.score}/100 jääb alla 65 lävendi.`);
    if (scores.coverage.score < 70) exclusions.push(`Coverage ${scores.coverage.score}/100 jääb alla 70 lävendi.`);
    if (evidence.marketCap != null && evidence.marketCap > MAX_KNOWN_MARKET_CAP) {
      exclusions.push(`Market cap ${formatBillions(evidence.marketCap)} ületab 75 miljardi piiri.`);
    }
    if (!catalyst.gate) exclusions.push('Nõutud ajavahemikus ei leitud katalüsaatorit.');
    const topGrowthReasons = getTopScoreReasons(growth, 2);
    evaluated.push({
      financials: financial, evidence, growth, health: scores.financialHealth,
      coverage: scores.coverage.score, criteria, catalyst,
      reasons: growth ? [
        `Growth ${growth.score}/100 ja Coverage ${scores.coverage.score}/100 läbivad baasfiltri.`,
        ...topGrowthReasons.map((reason) => `${reason.label}: ${reason.detail}.`),
        catalyst.criterion.detail,
      ] : [],
      risks: buildRisks(financial, scores.financialHealth, evidence, scores.coverage.score),
      unknowns: buildUnknowns(financial, evidence, growth, scores.financialHealth),
      proofQuestions: [
        'Mis on ettevõtte kaitstav konkurentsieelis ja milline algallikas seda tõendab?',
        'Mida turg praegu valesti hinnastab ning milline vastupidine seletus on võimalik?',
        'Mis peab järgmise 12 kuu jooksul mõõdetavalt juhtuma?',
      ],
      exclusionReasons: exclusions,
      sectorRelative,
    });
  }

  const eligible = evaluated.filter((item) => item.exclusionReasons.length === 0).sort(candidateOrder);
  const selected = eligible.slice(0, MAX_CANDIDATES);
  const selectedRank = new Map(selected.map((item, index) => [item.evidence.ticker, index + 1]));
  for (const item of eligible.slice(MAX_CANDIDATES)) {
    item.exclusionReasons.push('Läbis baasfiltrid, kuid jäi viie kõrgeima järjestusega kandidaadi piirist välja.');
  }
  const decisions = evaluated.map((item) => {
    const rank = selectedRank.get(item.evidence.ticker) ?? null;
    return decisionInput(item, rank != null, rank);
  });
  const runAt = new Date();
  const run = await recordDiscoveryRun(RULES, decisions, runAt);
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
    catalystAt: item.catalyst.catalystAt,
    sectorRelative: item.sectorRelative,
  }));

  return {
    candidates,
    evaluatedCompanies: evaluated.length,
    generatedAt: runAt.toISOString(),
    rules: RULES,
    runId: run.runId,
    runReused: !run.created,
  };
}
