import type { CatalystEvidence } from './catalyst-evidence';
import type { CompanyScore } from './company-scores';
import type { AlignmentStatus, DataQualitySummary, FreshnessStatus } from './data-quality';
import type { SectorRelativeStats } from './sector-relative';

// Under-recognition Evidence V0 (docs/UNDER_RECOGNITION_AND_CHALLENGER.md § 1, § 4.1).
//
// EI ole skoor, EI ole ranking, EI muuda filtreid. See on kompositsioonikiht: ta
// LOEB teiste kihtide väljundit (Catalyst novelty, Data Freshness/Alignment,
// Growth/Health, sector-relative market cap, analyst kate) ega arvuta neid uuesti
// — nii ei dubleeri ta Catalyst ega Valuation evidence't.
//
// Küsimus: „kas ettevõte võib olla varajane research-kandidaat, sest tõend on
// paranemas, aga turg/konsensus ei pruugi seda veel täielikult hinnastada?"
// Vastus on tuletatud OLEK (viis teksti), mitte number. `unknown` on lubatud
// kõikjal; puuduvat infot ei asendata oletusega.

export const UNDER_RECOGNITION_VERSION = 'under-recognition-v0';

// Läved on läbipaistvad heuristikad, mitte tõestatud valem; kalibreeritakse
// alles päris cohorti kasvades. Ükski neist ei tooda protsendiskoori.
export const ANALYST_LOW_MAX = 3;              // ≤3 analüütikut = madal tähelepanu
export const MCAP_SMALL_MAX_PERCENTILE = 40;   // sektori alumine ~40% = väike peer'ide suhtes
export const MCAP_LARGE_MIN_PERCENTILE = 60;   // ülemine ~40% = suur, tähelepanu tõenäoliselt olemas
export const GROWTH_IMPROVING_MIN = 65;        // sama baaslävi nagu RKLB discovery Growth-filter
export const HEALTH_SURVIVAL_FLOOR = 40;       // alla selle = ellujäämisrisk

export type UnderRecognitionState =
  | 'meaningful'
  | 'attention_only'
  | 'no_attention_gap'
  | 'low_confidence'
  | 'unknown';

export type AnalystAttention = 'low' | 'high' | 'unknown';
export type MarketCapContext = 'small_vs_peers' | 'large' | 'unknown';
export type FrequencyBehavior = 'low_rising' | 'stable' | 'high' | 'unknown';
export type PriceReaction = 'muted' | 'reacted' | 'unknown';
export type CatalystNovelty = 'material_new_evidence' | 'weak' | 'unknown';
export type FinancialsTrend = 'improving' | 'flat_or_declining' | 'unknown';

export interface UnderRecognitionSignal<T> {
  value: T;
  basis: string;
}

export interface UnderRecognitionEvidence {
  version: typeof UNDER_RECOGNITION_VERSION;
  state: UnderRecognitionState;
  stateLabel: string;
  stateDetail: string;
  analystAttention: UnderRecognitionSignal<AnalystAttention>;
  marketCapContext: UnderRecognitionSignal<MarketCapContext>;
  discoveryFrequency: UnderRecognitionSignal<FrequencyBehavior>;
  priceReaction: UnderRecognitionSignal<PriceReaction>;
  catalystNovelty: UnderRecognitionSignal<CatalystNovelty>;
  improvingFinancials: UnderRecognitionSignal<FinancialsTrend>;
  reasons: string[];
  unknowns: string[];
}

export interface UnderRecognitionInput {
  analystOpinions: number | null;
  marketCapPercentile: number | null;
  sectorComparableCount: number | null;
  catalystStatus: string | null;   // CatalystEvidence.status; ainult 'material_new_evidence' on tugev
  growthScore: number | null;
  healthScore: number | null;
  freshnessStatus: FreshnessStatus;
  alignmentStatus: AlignmentStatus;
}

const STATE_LABELS: Record<UnderRecognitionState, string> = {
  meaningful: 'Meaningful',
  attention_only: 'Attention only',
  no_attention_gap: 'No attention gap',
  low_confidence: 'Low confidence',
  unknown: 'Unknown',
};

const STATE_DETAILS: Record<UnderRecognitionState, string> = {
  meaningful: 'Madal tähelepanu ja paranev tõend usaldusväärsel andmel — varajane research-kandidaat, mitte ostusignaal.',
  attention_only: 'Tähelepanu on madal, aga paranevat tõendit pole — ignored-for-a-reason / penny-stock muster, mitte võimalus.',
  no_attention_gap: 'Turg juba jälgib seda nime — tähelepanu-edge\'t pole, olgu tõend milline tahes.',
  low_confidence: 'Tõend paraneb, aga andmealus on ebausaldusväärne (poor/stale) või health viitab ellujäämisriskile — vaata, ära kaalu veel.',
  unknown: 'Alamärgatuse hindamiseks pole piisavalt infot; puuduvat ei asendata oletusega.',
};

function classifyAnalyst(opinions: number | null): UnderRecognitionSignal<AnalystAttention> {
  if (opinions == null) return { value: 'unknown', basis: 'Analyst coverage puudub; puuduv kate ≠ null kate.' };
  if (opinions <= ANALYST_LOW_MAX) return { value: 'low', basis: `${opinions} analüütikut (≤${ANALYST_LOW_MAX}) — tähelepanu pole veel saabunud.` };
  return { value: 'high', basis: `${opinions} analüütikut — konsensus on juba olemas.` };
}

function classifyMarketCap(percentile: number | null, comparables: number | null): UnderRecognitionSignal<MarketCapContext> {
  if (percentile == null || (comparables != null && comparables < 5)) {
    return { value: 'unknown', basis: 'Sektori percentile puudub (alla viie võrreldava ettevõtte).' };
  }
  if (percentile <= MCAP_SMALL_MAX_PERCENTILE) {
    return { value: 'small_vs_peers', basis: `Market cap percentiil ${Math.round(percentile)} — väike peeride suhtes (veel radari all).` };
  }
  if (percentile >= MCAP_LARGE_MIN_PERCENTILE) {
    return { value: 'large', basis: `Market cap percentiil ${Math.round(percentile)} — suur peeride suhtes.` };
  }
  return { value: 'unknown', basis: `Market cap percentiil ${Math.round(percentile)} — keskmine, ei väike ega selgelt suur.` };
}

function classifyCatalyst(status: string | null): UnderRecognitionSignal<CatalystNovelty> {
  if (status == null) return { value: 'unknown', basis: 'Catalyst evidence ei ole selle vaate jaoks arvutatud.' };
  if (status === 'material_new_evidence') return { value: 'material_new_evidence', basis: 'Catalyst V2: material_new_evidence — uus mõõdetav tõend.' };
  return { value: 'weak', basis: `Catalyst V2: ${status} — mitte materiaalne uus tõend.` };
}

function classifyFinancials(growthScore: number | null): UnderRecognitionSignal<FinancialsTrend> {
  if (growthScore == null) return { value: 'unknown', basis: 'Growth skoor puudub (andmekate liiga madal).' };
  if (growthScore >= GROWTH_IMPROVING_MIN) return { value: 'improving', basis: `Growth ${growthScore} ≥ ${GROWTH_IMPROVING_MIN} — numbrid liiguvad.` };
  return { value: 'flat_or_declining', basis: `Growth ${growthScore} < ${GROWTH_IMPROVING_MIN} — numbrid ei liigu piisavalt.` };
}

export function calculateUnderRecognitionEvidence(input: UnderRecognitionInput): UnderRecognitionEvidence {
  const analystAttention = classifyAnalyst(input.analystOpinions);
  const marketCapContext = classifyMarketCap(input.marketCapPercentile, input.sectorComparableCount);
  const catalystNovelty = classifyCatalyst(input.catalystStatus);
  const improvingFinancials = classifyFinancials(input.growthScore);
  // V0-s ei arvutata frequency't ega hinnareaktsiooni: mõlemad on ausalt unknown.
  const discoveryFrequency: UnderRecognitionSignal<FrequencyBehavior> = {
    value: 'unknown',
    basis: 'V0 ei loe frequency näitajat; canonical seeria on tõlgenduseks liiga lühike (§ 7.5).',
  };
  const priceReaction: UnderRecognitionSignal<PriceReaction> = {
    value: 'unknown',
    basis: 'V0 ei arvuta hinnareaktsiooni (look-ahead ja üksikpunkti risk).',
  };

  const attentionGap = analystAttention.value === 'low' || marketCapContext.value === 'small_vs_peers';
  const attentionHigh = !attentionGap && (analystAttention.value === 'high' || marketCapContext.value === 'large');
  const improvingEvidence = catalystNovelty.value === 'material_new_evidence' || improvingFinancials.value === 'improving';
  const dataTrustworthy = input.alignmentStatus !== 'poor' && input.freshnessStatus !== 'stale';
  const healthOk = input.healthScore != null && input.healthScore >= HEALTH_SURVIVAL_FLOOR;

  const reasons: string[] = [];
  let state: UnderRecognitionState;
  if (attentionHigh) {
    // Guardrail: kõrge tähelepanu tähendab, et under-recognition edge't pole —
    // olgu tõend/narratiiv milline tahes. See on terminaalne vastus (nt kõrge
    // analüütikute kate). Tuleb enne low_confidence't, sest well-covered nime
    // puhul ei ole varjatud võimalust, mida „paremad andmed" avaks.
    state = 'no_attention_gap';
    reasons.push('Turg juba jälgib seda nime; tähelepanu-edge puudub.');
  } else if (improvingEvidence && !(dataTrustworthy && healthOk)) {
    // Guardrail: paranev tõend ebausaldusväärsel alusel (BW muster) või
    // ellujäämisriski juures ei ole meaningful.
    state = 'low_confidence';
    if (!dataTrustworthy) reasons.push('Paranev tõend, aga andmealus on poor/stale — ei saa veel usaldada.');
    if (!healthOk) reasons.push('Paranev tõend, aga Financial Health viitab ellujäämisriskile.');
  } else if (attentionGap && improvingEvidence && dataTrustworthy && healthOk) {
    state = 'meaningful';
    reasons.push('Tähelepanu-lõhe olemas (madal kate või väike cap peeride suhtes).');
    reasons.push('Paranev tõend olemas (material catalyst või liikuvad numbrid).');
    reasons.push('Andmed on värsked/joondatud ja Health ei viita ellujäämisriskile.');
  } else if (attentionGap && !improvingEvidence) {
    // Guardrail: madal tähelepanu ilma paraneva tõendita = ignored-for-a-reason / penny-stock.
    state = 'attention_only';
    reasons.push('Tähelepanu on madal, aga paranevat tõendit pole — mitte võimalus.');
  } else {
    state = 'unknown';
    reasons.push('Tähelepanu-lõhet ega paranevat tõendit ei saa olemasolevatest andmetest kinnitada.');
  }

  const unknowns: string[] = [];
  if (analystAttention.value === 'unknown') unknowns.push('Analyst attention');
  if (marketCapContext.value === 'unknown') unknowns.push('Market cap context');
  unknowns.push('Discovery frequency (V0)');
  unknowns.push('Price reaction (V0)');
  if (catalystNovelty.value === 'unknown') unknowns.push('Catalyst novelty');
  if (improvingFinancials.value === 'unknown') unknowns.push('Improving financials');

  return {
    version: UNDER_RECOGNITION_VERSION,
    state,
    stateLabel: STATE_LABELS[state],
    stateDetail: STATE_DETAILS[state],
    analystAttention,
    marketCapContext,
    discoveryFrequency,
    priceReaction,
    catalystNovelty,
    improvingFinancials,
    reasons,
    unknowns,
  };
}

// Adapter: olemasolevate kihtide väljundist → under-recognition evidence. Puhas
// ümberkujundamine, ei tee DB-päringut ega arvuta ühtki teist kihti uuesti.
export function buildUnderRecognitionEvidence(params: {
  analystOpinions: number | null;
  sectorRelative: SectorRelativeStats | null;
  catalyst: CatalystEvidence | null;
  growth: CompanyScore | null;
  health: CompanyScore | null;
  dataQuality: DataQualitySummary;
}): UnderRecognitionEvidence {
  return calculateUnderRecognitionEvidence({
    analystOpinions: params.analystOpinions,
    marketCapPercentile: params.sectorRelative?.marketCap.percentile ?? null,
    sectorComparableCount: params.sectorRelative?.comparableCount ?? null,
    catalystStatus: params.catalyst?.status ?? null,
    growthScore: params.growth?.score ?? null,
    healthScore: params.health?.score ?? null,
    freshnessStatus: params.dataQuality.freshnessStatus,
    alignmentStatus: params.dataQuality.alignmentStatus,
  });
}
