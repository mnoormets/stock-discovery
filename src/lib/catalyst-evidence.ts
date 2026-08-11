import type { CompanyFinancialSummary, FinancialMetric, FinancialPeriodKind } from './company-financials';
import { GOOD_ALIGNMENT_SPAN_DAYS, STALE_FACT_DAYS, type DataQualitySummary, type FreshnessStatus } from './data-quality';

export const CATALYST_ASSESSMENT_VERSION = 'catalyst-evidence-v2';

// Läved on läbipaistvad heuristikad, mis kalibreeriti olemasoleva research
// cohort'i (API, BW, CAKE, HIMS, ACHR) ja PLUG false-positive kontrolli päris
// SEC faktide järgi. Need ei ole tõestatud investeerimisvalem.
export const MAJOR_REVENUE_CHANGE_PERCENT = 25;
export const MINOR_REVENUE_CHANGE_PERCENT = 5;
export const MINOR_PROFIT_CHANGE_PERCENT = 20;
export const DILUTION_COUNTER_EVIDENCE_PERCENT = 5;
export const MANDATE_FIT_GROWTH_PERCENT = 25;
export const MANDATE_PARTIAL_GROWTH_PERCENT = 10;
export const MANDATE_MAX_MARKET_CAP = 25_000_000_000;
export const MANDATE_EARLY_MARKET_CAP = 3_000_000_000;
export const SCHEDULED_WATCH_DAYS = 45;
export const EXPECTED_DISCLOSURE_GRACE_DAYS = 10;
export const EXPECTED_DISCLOSURE_LOOKBACK_DAYS = 90;

export type CatalystEventKind =
  | 'earnings_scheduled'
  | 'earnings_disclosed'
  | 'sec_filing'
  | 'company_release'
  | 'news_headline';

export type CatalystSourceKind = 'primary_sec' | 'primary_ir' | 'secondary_news' | 'social';
export type CatalystMateriality = 'quantified_major' | 'quantified_minor' | 'unquantified' | 'unknown';
export type CatalystDirection = 'improving' | 'deteriorating' | 'mixed' | 'unknown';
export type CatalystNovelty = 'new_information' | 'confirms_known' | 'repeat_of_prior_event' | 'unknown';
export type CatalystRelevance = 'decisive' | 'supporting' | 'adjacent' | 'not_relevant' | 'unknown';
export type CatalystMandateRelevance = 'fits' | 'partial' | 'not_relevant' | 'unknown';
export type CatalystEvidenceStatus =
  | 'material_new_evidence'
  | 'weak_or_unconfirmed'
  | 'scheduled_only'
  | 'collection_gap'
  | 'none_recorded';

// SEC vormid, mis võivad kanda sisulist uut tõendit. Kõik ülejäänud (nt 4, 144,
// SCHEDULE 13G, 424B) on administratiivsed: sündmus on olemas, tõend mitte.
const NOTABLE_SEC_FORMS = new Set(['8-K', '6-K', '10-Q', '10-K', '10-K/A', '10-Q/A', '20-F', '40-F', '425', 'S-1']);
const DRIVER_METRICS: FinancialMetric[] = ['revenue', 'net_income', 'operating_cash_flow', 'free_cash_flow'];
const FLOW_FLIP_METRICS: FinancialMetric[] = ['net_income', 'operating_cash_flow', 'free_cash_flow'];
const DAY_MS = 86_400_000;

const METRIC_LABELS: Record<FinancialMetric, string> = {
  revenue: 'Revenue',
  net_income: 'Net income',
  operating_cash_flow: 'Operating cash flow',
  capital_expenditure: 'Capital expenditure',
  free_cash_flow: 'Free cash flow',
  cash: 'Cash',
  debt: 'Debt',
  shares_outstanding: 'Shares outstanding',
};

export interface CatalystMetricSignal {
  metric: FinancialMetric;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  periodEnd: string | null;
  periodKind: FinancialPeriodKind | null;
  stale: boolean;
  usable: boolean;
  flip: 'to_positive' | 'to_negative' | null;
}

export interface CatalystSignals {
  newestPeriodEnd: string | null;
  freshness: FreshnessStatus;
  marketCap: number | null;
  metrics: CatalystMetricSignal[];
  staleMetricCount: number;
  periodSpanDays: number | null;
}

export interface CatalystEventObservation {
  id: number | null;
  kind: CatalystEventKind;
  sourceKind: CatalystSourceKind;
  sourceRef: string;
  occurredAt: string | null;
  headline: string | null;
  url: string | null;
  accessionNumber: string | null;
  form: string | null;
  linkedFactIds: number[];
  linkedPeriodEnd: string | null;
  linkedPeriodKind: FinancialPeriodKind | null;
}

export interface CatalystAssessment {
  version: typeof CATALYST_ASSESSMENT_VERSION;
  materiality: CatalystMateriality;
  materialityBasis: string;
  materialityRatio: number | null;
  direction: CatalystDirection;
  directionBasis: string;
  novelty: CatalystNovelty;
  noveltyBasis: string;
  sourceQuality: CatalystSourceKind;
  thesisRelevance: CatalystRelevance;
  relevanceTarget: string;
  mandateRelevance: CatalystMandateRelevance;
  mandateBasis: string;
  evidenceFreshness: FreshnessStatus;
  assessedBy: 'rule' | 'user';
  notes: string;
}

export interface AssessedCatalystEvent {
  event: CatalystEventObservation;
  assessment: CatalystAssessment;
  status: CatalystEvidenceStatus;
  tier: number;
  summary: string;
}

export interface CatalystEvidence {
  version: typeof CATALYST_ASSESSMENT_VERSION;
  status: CatalystEvidenceStatus;
  tier: number;
  label: string;
  detail: string;
  criterionStatus: 'supported' | 'uncertain' | 'missing';
  strongest: AssessedCatalystEvent | null;
  events: AssessedCatalystEvent[];
  nextScheduledAt: string | null;
  lastScheduledAt: string | null;
  expectedButUnconfirmed: boolean;
  reasons: string[];
  counterEvidence: string[];
  unknowns: string[];
}

export const EVIDENCE_TIERS: Record<CatalystEvidenceStatus, number> = {
  material_new_evidence: 3,
  weak_or_unconfirmed: 2,
  scheduled_only: 1,
  collection_gap: 1,
  none_recorded: 0,
};

// Sama tier'i sees otsustab tõendi liik, mitte kuupäev: värske pealkiri ei tohi
// varjata sama ettevõtte avaldatud aruannet, mille numbrid jäid nõrgaks.
const EVENT_KIND_PRIORITY: Record<CatalystEventKind, number> = {
  earnings_disclosed: 4,
  company_release: 3,
  sec_filing: 2,
  news_headline: 1,
  earnings_scheduled: 0,
};

export const EVIDENCE_LABELS: Record<CatalystEvidenceStatus, string> = {
  material_new_evidence: 'Materiaalne uus tõend',
  weak_or_unconfirmed: 'Nõrk või kinnitamata tõend',
  scheduled_only: 'Ainult planeeritud kuupäev',
  collection_gap: 'Kogumislünk',
  none_recorded: 'Sündmust ei ole salvestatud',
};

function parseDay(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseMoment(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageInDays(value: string | null, asOf: Date): number | null {
  const moment = parseMoment(value);
  if (moment == null) return null;
  return Math.floor((asOf.getTime() - moment) / DAY_MS);
}

function percentText(value: number | null): string {
  if (value == null) return 'muutus teadmata';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;
}

function isRoutineForm(form: string | null): boolean {
  if (!form) return false;
  return !NOTABLE_SEC_FORMS.has(form.toUpperCase());
}

// Signaalid tulevad ainult olemasolevatest SEC faktidest ja data-quality-v1
// väljundist. Hinda, tähelepanu ega pealkirju siin ei kasutata.
export function buildCatalystSignals(
  financials: CompanyFinancialSummary | null,
  dataQuality: DataQualitySummary,
  marketCap: number | null,
  asOf = new Date(),
): CatalystSignals {
  const qualityByMetric = new Map(dataQuality.metrics.map((metric) => [metric.metric, metric]));
  const newest = parseDay(dataQuality.newestPeriodEnd);
  const metrics: CatalystMetricSignal[] = [];
  for (const [metric, summary] of Object.entries(financials?.metrics || {}) as Array<[FinancialMetric, NonNullable<CompanyFinancialSummary['metrics'][FinancialMetric]>]>) {
    if (!summary) continue;
    const quality = qualityByMetric.get(metric);
    const periodEnd = summary.latest.periodEnd || null;
    const period = parseDay(periodEnd);
    const stale = quality ? quality.stale : (ageInDays(periodEnd, asOf) ?? 0) > STALE_FACT_DAYS;
    const aligned = period != null && newest != null
      ? Math.abs(newest - period) / DAY_MS <= GOOD_ALIGNMENT_SPAN_DAYS
      : false;
    const previousValue = summary.previousComparable?.value ?? null;
    const flip = previousValue != null && previousValue !== 0 && summary.latest.value !== 0
      ? (previousValue < 0 && summary.latest.value > 0 ? 'to_positive' as const
        : previousValue > 0 && summary.latest.value < 0 ? 'to_negative' as const : null)
      : null;
    metrics.push({
      metric,
      value: summary.latest.value,
      previousValue,
      changePercent: summary.yearOverYearPercent,
      periodEnd,
      periodKind: summary.latest.periodKind || null,
      stale,
      usable: !stale && aligned,
      flip,
    });
  }
  return {
    newestPeriodEnd: dataQuality.newestPeriodEnd,
    freshness: dataQuality.freshnessStatus,
    marketCap,
    metrics,
    staleMetricCount: dataQuality.staleMetricCount,
    periodSpanDays: dataQuality.periodSpanDays,
  };
}

function usableDrivers(signals: CatalystSignals): CatalystMetricSignal[] {
  return signals.metrics.filter((metric) => metric.usable && DRIVER_METRICS.includes(metric.metric));
}

function materialityOf(signals: CatalystSignals): Pick<CatalystAssessment, 'materiality' | 'materialityBasis' | 'materialityRatio'> {
  const drivers = usableDrivers(signals);
  if (drivers.length === 0) {
    return {
      materiality: 'unknown',
      materialityBasis: 'Värskeid ja joondatud revenue/kasumi/rahavoo sisendeid ei ole; materiality’t ei saa hinnata.',
      materialityRatio: null,
    };
  }
  const flip = drivers.find((metric) => metric.flip && FLOW_FLIP_METRICS.includes(metric.metric));
  if (flip) {
    return {
      materiality: 'quantified_major',
      materialityBasis: `${METRIC_LABELS[flip.metric]} pöördus ${flip.flip === 'to_positive' ? 'positiivseks' : 'negatiivseks'} perioodil ${flip.periodEnd} (${percentText(flip.changePercent)} YoY).`,
      materialityRatio: flip.changePercent == null ? null : Math.abs(flip.changePercent),
    };
  }
  const revenue = drivers.find((metric) => metric.metric === 'revenue');
  if (revenue?.changePercent != null && Math.abs(revenue.changePercent) >= MAJOR_REVENUE_CHANGE_PERCENT) {
    return {
      materiality: 'quantified_major',
      materialityBasis: `Revenue ${percentText(revenue.changePercent)} YoY perioodil ${revenue.periodEnd}; baas on eelmine võrreldav periood.`,
      materialityRatio: Math.abs(revenue.changePercent),
    };
  }
  if (revenue?.changePercent != null && Math.abs(revenue.changePercent) >= MINOR_REVENUE_CHANGE_PERCENT) {
    return {
      materiality: 'quantified_minor',
      materialityBasis: `Revenue ${percentText(revenue.changePercent)} YoY perioodil ${revenue.periodEnd}; muutus on mõõdetav, kuid järkjärguline.`,
      materialityRatio: Math.abs(revenue.changePercent),
    };
  }
  // Rahavoo/kasumi muutus loeb ainult siis, kui tase on päriselt positiivne.
  // Endiselt negatiivse rahavoo protsentuaalne paranemine ei ole materiaalne.
  const profit = drivers.find((metric) => metric.metric !== 'revenue' && metric.value > 0
    && metric.changePercent != null && Math.abs(metric.changePercent) >= MINOR_PROFIT_CHANGE_PERCENT);
  if (profit) {
    return {
      materiality: 'quantified_minor',
      materialityBasis: `${METRIC_LABELS[profit.metric]} on positiivne ja ${percentText(profit.changePercent)} YoY perioodil ${profit.periodEnd}.`,
      materialityRatio: profit.changePercent == null ? null : Math.abs(profit.changePercent),
    };
  }
  const revenueText = revenue?.changePercent == null
    ? 'revenue YoY võrdlus puudub'
    : `revenue ainult ${percentText(revenue.changePercent)} YoY`;
  return {
    materiality: 'unquantified',
    materialityBasis: `Kvantifitseeritud materiaalset muutust ei leitud: ${revenueText} ning kasum/rahavoo tase ei kanna mõõdetavat pööret.`,
    materialityRatio: revenue?.changePercent == null ? null : Math.abs(revenue.changePercent),
  };
}

function directionOf(signals: CatalystSignals): Pick<CatalystAssessment, 'direction' | 'directionBasis'> & { positives: string[]; negatives: string[] } {
  const positives: string[] = [];
  const negatives: string[] = [];
  for (const metric of signals.metrics) {
    if (!metric.usable) continue;
    if (metric.metric === 'revenue' && metric.changePercent != null) {
      if (metric.changePercent > 0) positives.push(`revenue ${percentText(metric.changePercent)}`);
      else if (metric.changePercent < 0) negatives.push(`revenue ${percentText(metric.changePercent)}`);
      continue;
    }
    if (FLOW_FLIP_METRICS.includes(metric.metric)) {
      if (metric.value > 0) positives.push(`${METRIC_LABELS[metric.metric].toLowerCase()} positiivne`);
      else if (metric.value < 0) negatives.push(`${METRIC_LABELS[metric.metric].toLowerCase()} negatiivne`);
      continue;
    }
    if (metric.metric === 'shares_outstanding' && metric.changePercent != null
      && metric.changePercent >= DILUTION_COUNTER_EVIDENCE_PERCENT) {
      negatives.push(`aktsiate arv ${percentText(metric.changePercent)}`);
    }
  }
  const direction: CatalystDirection = positives.length && negatives.length ? 'mixed'
    : positives.length ? 'improving'
      : negatives.length ? 'deteriorating' : 'unknown';
  const basis = direction === 'unknown'
    ? 'Suunda ei saa olemasolevatest värsketest sisenditest tuletada.'
    : `Toetav: ${positives.join(', ') || 'puudub'}. Vastupidine: ${negatives.join(', ') || 'puudub'}.`;
  return { direction, directionBasis: basis, positives, negatives };
}

function noveltyOf(
  event: CatalystEventObservation,
  signals: CatalystSignals,
  priorEvents: CatalystEventObservation[],
): Pick<CatalystAssessment, 'novelty' | 'noveltyBasis'> {
  if (event.kind === 'earnings_scheduled') {
    return { novelty: 'unknown', noveltyBasis: 'Planeeritud kuupäev ei kanna veel infot.' };
  }
  if (event.kind === 'news_headline') {
    return { novelty: 'unknown', noveltyBasis: 'Pealkiri üksi ei tõenda, et info on uus.' };
  }
  if (!event.linkedFactIds.length) {
    const repeat = priorEvents.find((prior) => prior.kind === event.kind && prior.form === event.form
      && prior.sourceRef !== event.sourceRef);
    return repeat
      ? { novelty: 'repeat_of_prior_event', noveltyBasis: `Sama vormi ${event.form || 'filing'} on varem salvestatud (${repeat.occurredAt?.slice(0, 10) || 'kuupäev teadmata'}).` }
      : { novelty: 'unknown', noveltyBasis: 'Filing on salvestatud, kuid ühtegi finantsfakti ei ole sellega seotud.' };
  }
  const linked = parseDay(event.linkedPeriodEnd);
  const newest = parseDay(signals.newestPeriodEnd);
  const priorWithSamePeriod = priorEvents.find((prior) => prior.sourceRef !== event.sourceRef
    && prior.linkedPeriodEnd && event.linkedPeriodEnd && prior.linkedPeriodEnd === event.linkedPeriodEnd);
  if (priorWithSamePeriod) {
    return {
      novelty: 'repeat_of_prior_event',
      noveltyBasis: `Sama periood ${event.linkedPeriodEnd} oli juba varasema sündmusega seotud.`,
    };
  }
  if (linked != null && newest != null && Math.abs(newest - linked) / DAY_MS <= GOOD_ALIGNMENT_SPAN_DAYS) {
    return {
      novelty: 'new_information',
      noveltyBasis: `Avaldus tõi ettevõtte uusima majandusperioodi ${event.linkedPeriodEnd} ja ${event.linkedFactIds.length} SEC fakti.`,
    };
  }
  return {
    novelty: 'confirms_known',
    noveltyBasis: `Seotud periood ${event.linkedPeriodEnd || 'teadmata'} ei ole ettevõtte uusim periood ${signals.newestPeriodEnd || 'teadmata'}.`,
  };
}

function relevanceOf(
  event: CatalystEventObservation,
  materiality: CatalystMateriality,
): Pick<CatalystAssessment, 'thesisRelevance' | 'relevanceTarget'> {
  if (event.kind === 'earnings_scheduled') {
    return {
      thesisRelevance: 'unknown',
      relevanceTarget: 'Kuupäev ütleb ainult, millal järgmist tõendit vaadata.',
    };
  }
  if (event.kind === 'news_headline') {
    return {
      thesisRelevance: 'unknown',
      relevanceTarget: 'Pealkirja seost teesi avatud küsimusega peab kontrollima inimene algallikast.',
    };
  }
  if (isRoutineForm(event.form)) {
    return {
      thesisRelevance: 'not_relevant',
      relevanceTarget: `Vorm ${event.form} on administratiivne ega vasta ühelegi teesi avatud küsimusele.`,
    };
  }
  if (materiality === 'quantified_major') {
    return {
      thesisRelevance: 'decisive',
      relevanceTarget: 'Puudutab otse avatud küsimust, kas kasvu ja rahavoo pööre püsib järgmistes võrreldavates perioodides.',
    };
  }
  if (materiality === 'quantified_minor') {
    return {
      thesisRelevance: 'supporting',
      relevanceTarget: 'Toetab olemasolevat pilti, kuid ei otsusta teesi kaitstavust.',
    };
  }
  return {
    thesisRelevance: 'adjacent',
    relevanceTarget: 'Sündmus on päris, kuid otsustav majandustõend jääb kvantifitseerimata.',
  };
}

// Mandate-relevance on teadlikult teesi relevance'ist eraldi: CAKE tõestas, et
// hea ettevõtte päris sündmus ei pruugi sobida varajase asümmeetria mandaadiga.
function mandateOf(
  signals: CatalystSignals,
  materiality: CatalystMateriality,
): Pick<CatalystAssessment, 'mandateRelevance' | 'mandateBasis'> {
  const revenue = usableDrivers(signals).find((metric) => metric.metric === 'revenue');
  const growth = revenue?.changePercent ?? null;
  const cap = signals.marketCap;
  const capText = cap == null ? 'market cap teadmata' : `market cap ${(cap / 1_000_000_000).toFixed(1)} mld`;
  if (cap != null && cap > MANDATE_MAX_MARKET_CAP) {
    return { mandateRelevance: 'not_relevant', mandateBasis: `${capText} ületab varajase asümmeetria mandaadi 25 mld piiri.` };
  }
  if (growth == null && materiality === 'unknown') {
    return { mandateRelevance: 'unknown', mandateBasis: `Revenue kasvu ei saa hinnata; ${capText}.` };
  }
  if (growth != null && growth >= MANDATE_FIT_GROWTH_PERCENT) {
    return { mandateRelevance: 'fits', mandateBasis: `Revenue ${percentText(growth)} YoY ja ${capText} vastavad varajase kasvu profiilile.` };
  }
  if (growth != null && growth >= MANDATE_PARTIAL_GROWTH_PERCENT) {
    return { mandateRelevance: 'partial', mandateBasis: `Revenue ${percentText(growth)} YoY on mõõdukas; ${capText}.` };
  }
  if (materiality === 'quantified_major' && cap != null && cap <= MANDATE_EARLY_MARKET_CAP) {
    return { mandateRelevance: 'partial', mandateBasis: `Kasv on aeglane, kuid kasumlikkuse/rahavoo pööre ja ${capText} hoiavad asümmeetria võimalikuna.` };
  }
  if (growth == null) {
    return { mandateRelevance: 'unknown', mandateBasis: `Revenue YoY võrdlus puudub; ${capText}.` };
  }
  return {
    mandateRelevance: 'not_relevant',
    mandateBasis: `Revenue ${percentText(growth)} YoY koos ${capText} ei anna otsitud varajase asümmeetria profiili.`,
  };
}

function eventFreshness(event: CatalystEventObservation, signals: CatalystSignals, asOf: Date): FreshnessStatus {
  const linkedAge = ageInDays(event.linkedPeriodEnd, asOf);
  if (linkedAge != null && linkedAge > STALE_FACT_DAYS) return 'stale';
  return signals.freshness;
}

export function assessCatalystEvent(
  event: CatalystEventObservation,
  signals: CatalystSignals,
  priorEvents: CatalystEventObservation[] = [],
  asOf = new Date(),
): AssessedCatalystEvent {
  const scheduled = event.kind === 'earnings_scheduled';
  const routine = event.kind === 'sec_filing' && isRoutineForm(event.form);
  const materiality = scheduled || event.kind === 'news_headline' || routine
    ? {
      materiality: 'unknown' as CatalystMateriality,
      materialityBasis: scheduled
        ? 'Planeeritud kuupäeva juures ei ole veel ühtegi avaldatud numbrit.'
        : routine
          ? `Vorm ${event.form} on administratiivne; kvantifitseeritud sisu ei ole.`
          : 'Pealkiri ei kanna kontrollitavat numbrit ega võrdlusbaasi.',
      materialityRatio: null,
    }
    : materialityOf(signals);
  const direction = scheduled || event.kind === 'news_headline' || routine
    ? { direction: 'unknown' as CatalystDirection, directionBasis: 'Suunda ei tuletata sündmuse olemasolust.', positives: [], negatives: [] }
    : directionOf(signals);
  const novelty = noveltyOf(event, signals, priorEvents);
  const relevance = relevanceOf(event, materiality.materiality);
  const mandate = scheduled || event.kind === 'news_headline' || routine
    ? { mandateRelevance: 'unknown' as CatalystMandateRelevance, mandateBasis: 'Mandaadi sobivust ei hinnata ilma kvantifitseeritud tõendita.' }
    : mandateOf(signals, materiality.materiality);
  const freshness = eventFreshness(event, signals, asOf);
  const primary = event.sourceKind === 'primary_sec' || event.sourceKind === 'primary_ir';
  const quantified = materiality.materiality === 'quantified_major' || materiality.materiality === 'quantified_minor';
  const status: CatalystEvidenceStatus = scheduled
    ? 'scheduled_only'
    : primary && !routine && quantified && direction.direction !== 'unknown'
      && novelty.novelty === 'new_information' && freshness !== 'stale'
      ? 'material_new_evidence'
      : 'weak_or_unconfirmed';
  const notes = [
    routine ? 'Administratiivne vorm: sündmus on olemas, tõend mitte.' : '',
    event.sourceKind === 'secondary_news' ? 'Sekundaarne allikas ei tõsta staatust üle nõrga tõendi.' : '',
    freshness === 'stale' ? 'Seotud periood on aegunud; värske teade ei tõsta aegunud tõendibaasi.' : '',
  ].filter(Boolean).join(' ');
  const assessment: CatalystAssessment = {
    version: CATALYST_ASSESSMENT_VERSION,
    ...materiality,
    direction: direction.direction,
    directionBasis: direction.directionBasis,
    ...novelty,
    sourceQuality: event.sourceKind,
    ...relevance,
    ...mandate,
    evidenceFreshness: freshness,
    assessedBy: 'rule',
    notes,
  };
  const occurred = event.occurredAt ? event.occurredAt.slice(0, 10) : 'kuupäev teadmata';
  const label = event.kind === 'earnings_scheduled' ? 'Planeeritud earnings'
    : event.kind === 'earnings_disclosed' ? `Avaldatud ${event.form || 'aruanne'}`
      : event.kind === 'sec_filing' ? `SEC ${event.form || 'filing'}`
        : event.kind === 'company_release' ? 'Ettevõtte teade' : 'Uudise pealkiri';
  return {
    event,
    assessment,
    status,
    tier: EVIDENCE_TIERS[status],
    summary: `${label} ${occurred}`,
  };
}

function counterEvidenceFrom(signals: CatalystSignals, direction: ReturnType<typeof directionOf>): string[] {
  const counter = [...direction.negatives.map((item) => `Vastutõend: ${item}.`)];
  if (signals.staleMetricCount > 0) {
    counter.push(`Vastutõend: ${signals.staleMetricCount} score-sisend on aegunud (üle ${STALE_FACT_DAYS} päeva).`);
  }
  if (signals.periodSpanDays != null && signals.periodSpanDays > GOOD_ALIGNMENT_SPAN_DAYS) {
    counter.push(`Vastutõend: sisendite perioodivahe on ${signals.periodSpanDays} päeva.`);
  }
  return counter;
}

export function deriveCatalystEvidence(
  observations: CatalystEventObservation[],
  signals: CatalystSignals,
  options: { asOf?: Date; nextScheduledAt?: string | null; lastScheduledAt?: string | null } = {},
): CatalystEvidence {
  const asOf = options.asOf || new Date();
  const ordered = [...observations].sort((a, b) => (parseMoment(b.occurredAt) ?? 0) - (parseMoment(a.occurredAt) ?? 0));
  const assessed = ordered.map((event, index) => assessCatalystEvent(event, signals, ordered.slice(index + 1), asOf));
  const ranked = [...assessed].sort((a, b) => b.tier - a.tier
    || EVENT_KIND_PRIORITY[b.event.kind] - EVENT_KIND_PRIORITY[a.event.kind]
    || (parseMoment(b.event.occurredAt) ?? 0) - (parseMoment(a.event.occurredAt) ?? 0));
  const strongest = ranked[0] || null;
  const lastScheduled = options.lastScheduledAt || null;
  const lastScheduledAge = ageInDays(lastScheduled, asOf);
  const disclosedAfterSchedule = assessed.some((item) => {
    if (item.event.kind !== 'earnings_disclosed') return false;
    const occurred = parseMoment(item.event.occurredAt);
    const scheduled = parseMoment(lastScheduled);
    if (occurred == null || scheduled == null) return false;
    return occurred >= scheduled - EXPECTED_DISCLOSURE_GRACE_DAYS * DAY_MS;
  });
  const expectedButUnconfirmed = lastScheduledAge != null
    && lastScheduledAge >= EXPECTED_DISCLOSURE_GRACE_DAYS
    && lastScheduledAge <= EXPECTED_DISCLOSURE_LOOKBACK_DAYS
    && !disclosedAfterSchedule;
  let status: CatalystEvidenceStatus = strongest ? strongest.status : 'none_recorded';
  if (expectedButUnconfirmed && (status === 'scheduled_only' || status === 'none_recorded')) status = 'collection_gap';
  const direction = directionOf(signals);
  const reasons: string[] = [];
  const unknowns: string[] = [];
  if (strongest && status !== 'collection_gap' && status !== 'none_recorded') {
    reasons.push(`${strongest.summary}: ${strongest.assessment.materialityBasis}`);
    if (strongest.assessment.direction !== 'unknown') reasons.push(`Suund ${strongest.assessment.direction}. ${strongest.assessment.directionBasis}`);
    reasons.push(`Uudsus ${strongest.assessment.novelty}. ${strongest.assessment.noveltyBasis}`);
    reasons.push(`Thesis-relevance ${strongest.assessment.thesisRelevance}. ${strongest.assessment.relevanceTarget}`);
    reasons.push(`Mandaat ${strongest.assessment.mandateRelevance}. ${strongest.assessment.mandateBasis}`);
  }
  if (status === 'collection_gap') {
    reasons.push(`Oodatud avaldust ei ole kogutud: earnings kuupäev ${lastScheduled?.slice(0, 10)} on möödas, kuid uut avaldatud perioodi ei ole salvestatud.`);
    unknowns.push('Kogumislünk ei tõenda, et ettevõttel sündmusi ei olnud.');
  }
  if (status === 'none_recorded') {
    reasons.push('Ühtegi salvestatud sündmust ei leitud; see ei ole tõend sündmusetuse kohta.');
  }
  if (status === 'scheduled_only') {
    unknowns.push('Planeeritud kuupäev ütleb ainult, millal vaadata; tõend on veel avaldamata.');
  }
  if (strongest?.assessment.materiality === 'unquantified') unknowns.push('Sündmuse materiality on kvantifitseerimata.');
  if (strongest?.assessment.materiality === 'unknown' && status !== 'none_recorded') unknowns.push('Materiality hindamiseks pole värskeid ja joondatud sisendeid.');
  if (strongest?.assessment.novelty === 'unknown') unknowns.push('Uudsust ei saa tõendada ilma seotud SEC faktideta.');
  if (!assessed.some((item) => item.event.sourceKind === 'primary_ir')) {
    unknowns.push('IR-teate kvantifitseeritud sisu ei ole kogutud; primary_ir katvus puudub olemasolevate allikatega.');
  }
  const criterionStatus = status === 'material_new_evidence' ? 'supported' as const
    : status === 'weak_or_unconfirmed' || status === 'scheduled_only' ? 'uncertain' as const
      : 'missing' as const;
  const detailParts = [EVIDENCE_LABELS[status]];
  if (strongest && status !== 'none_recorded' && status !== 'collection_gap') {
    detailParts.push(strongest.summary);
    detailParts.push(`allikas ${strongest.assessment.sourceQuality}`);
    detailParts.push(`materiality ${strongest.assessment.materiality}`);
    detailParts.push(`suund ${strongest.assessment.direction}`);
    detailParts.push(`uudsus ${strongest.assessment.novelty}`);
    detailParts.push(`relevance ${strongest.assessment.thesisRelevance}`);
    detailParts.push(`mandaat ${strongest.assessment.mandateRelevance}`);
  }
  if (options.nextScheduledAt) detailParts.push(`järgmine earnings ${options.nextScheduledAt.slice(0, 10)}`);
  if (status === 'collection_gap') detailParts.push(`oodatud avaldus ${lastScheduled?.slice(0, 10)} puudub`);
  return {
    version: CATALYST_ASSESSMENT_VERSION,
    status,
    tier: EVIDENCE_TIERS[status],
    label: EVIDENCE_LABELS[status],
    detail: `${detailParts.join(' · ')}.`,
    criterionStatus,
    strongest,
    events: assessed,
    nextScheduledAt: options.nextScheduledAt || null,
    lastScheduledAt: lastScheduled,
    expectedButUnconfirmed,
    reasons,
    counterEvidence: counterEvidenceFrom(signals, direction),
    unknowns,
  };
}

export function emptyCatalystEvidence(signals: CatalystSignals): CatalystEvidence {
  return deriveCatalystEvidence([], signals, {});
}
