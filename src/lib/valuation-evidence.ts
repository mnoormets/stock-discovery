import type { CompanyFinancialSummary, FinancialPeriodKind } from './company-financials';
import {
  GOOD_ALIGNMENT_SPAN_DAYS,
  POOR_ALIGNMENT_SPAN_DAYS,
  STALE_FACT_DAYS,
} from './data-quality';

// Valuation Evidence V1 — EI ole Valuation Score.
//
// Eesmärk: vastata küsimusele „mille vastu ma seda ettevõtet hinnastan?", mitte
// „Valuation = 83". Iga ankur on üks läbipaistev, allikaga suhtarv (fakt / fakt)
// või `unknown`. Ei ole koondskoori, ei ole kaalutud summat, ei ole buy/sell
// soovitust. `unknown` on lubatud kõikjal ja on aus vastus.
//
// Confidence ei ole number, vaid kvalitatiivne aste, mis tugineb olemasolevale
// Data Freshness + Period Alignment kihile: aegunud või joondamata sisendil
// põhinev multiple on madala usaldusega, isegi kui number arvutub.

export const VALUATION_EVIDENCE_VERSION = 'valuation-evidence-v2';

export type ValuationAnchorKind =
  | 'ev_sales'
  | 'pe'
  | 'fcf_yield'
  | 'peer_comparison'
  | 'sum_of_parts';

export type ValuationConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type ValuationAnchorStatus =
  | 'computable'        // suhtarv on olemasolevatest faktidest arvutatud
  | 'not_meaningful'    // sisend olemas, aga suhtarv ei ole tähenduslik (nt P/E negatiivse kasumi juures)
  | 'insufficient_data' // vajalik sisend puudub
  | 'unknown';          // V1 ei arvuta seda ankrut üldse (nt peer / sum-of-parts)

export type ValuationBasis = 'annual' | 'annualized_from_quarter';

export interface ValuationSourceRef {
  label: string;
  periodEnd: string | null;
  url: string | null;
}

export interface ValuationAnchor {
  kind: ValuationAnchorKind;
  label: string;
  status: ValuationAnchorStatus;
  value: number | null;
  unit: string | null;            // 'x' multiple, '%' yield
  basis: ValuationBasis | null;   // kuidas flow annualiseeriti
  confidence: ValuationConfidence;
  lastUpdated: string | null;     // uusim kasutatud sisendi periood (YYYY-MM-DD)
  sources: ValuationSourceRef[];
  note: string | null;            // aus selgitus või puuduva sisendi kirjeldus
}

export interface ValuationEvidenceSummary {
  version: typeof VALUATION_EVIDENCE_VERSION;
  marketCapKnown: boolean;
  hasAnyComputable: boolean;
  anchors: ValuationAnchor[];
}

export interface ValuationInputMetric {
  value: number;
  periodEnd: string | null;
  periodKind: FinancialPeriodKind | null;
  accessionNumber: string | null;
  sourceUrl: string | null;
  derived?: boolean;
}

export interface ValuationEvidenceInput {
  marketCap: number | null;
  revenue: ValuationInputMetric | null;
  netIncome: ValuationInputMetric | null;
  freeCashFlow: ValuationInputMetric | null;
  cash: ValuationInputMetric | null;
  debt: ValuationInputMetric | null;
}

const DAY_MS = 86_400_000;

const ANCHOR_LABELS: Record<ValuationAnchorKind, string> = {
  ev_sales: 'EV / Sales',
  pe: 'P / E',
  fcf_yield: 'FCF Yield',
  peer_comparison: 'Peer comparison',
  sum_of_parts: 'Sum-of-parts',
};

function parsePeriod(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageInDays(periodEnd: string | null, asOf: Date): number | null {
  const period = parsePeriod(periodEnd);
  if (period == null) return null;
  return Math.max(0, Math.floor((asOf.getTime() - period) / DAY_MS));
}

// Flow-mõõdik annualiseeritakse ausalt märgistatud alusega. YTD ja tundmatu
// periood ei annualiseeru puhtalt, seega neid ei sunnita multiple'iks.
function annualizeFlow(
  metric: ValuationInputMetric | null,
): { value: number; basis: ValuationBasis } | null {
  if (!metric) return null;
  if (metric.periodKind === 'annual') return { value: metric.value, basis: 'annual' };
  if (metric.periodKind === 'quarter') return { value: metric.value * 4, basis: 'annualized_from_quarter' };
  return null; // ytd / instant / unknown → ei annualiseeri
}

// Confidence tuletatakse sama loogikaga, mis Data Freshness + Period Alignment:
// aegunud sisend → low; suur perioodivahe → low/medium; värske ja joondatud →
// high. Annualiseerimisel kvartalist langeb usaldus vähemalt medium'ini.
function inputsConfidence(
  inputs: ValuationInputMetric[],
  asOf: Date,
  annualizedFromQuarter: boolean,
): ValuationConfidence {
  const ages = inputs
    .map((input) => ageInDays(input.periodEnd, asOf))
    .filter((age): age is number => age != null);
  if (ages.length === 0) return 'unknown';

  const anyStale = ages.some((age) => age > STALE_FACT_DAYS);
  const periods = inputs
    .map((input) => parsePeriod(input.periodEnd))
    .filter((period): period is number => period != null);
  const spanDays = periods.length >= 2
    ? Math.round((Math.max(...periods) - Math.min(...periods)) / DAY_MS)
    : null;
  const durationKinds = new Set(
    inputs
      .map((input) => input.periodKind)
      .filter((kind): kind is Exclude<FinancialPeriodKind, 'instant'> => Boolean(kind && kind !== 'instant')),
  );

  let confidence: ValuationConfidence;
  if (anyStale) confidence = 'low';
  else if (spanDays != null && spanDays > POOR_ALIGNMENT_SPAN_DAYS) confidence = 'low';
  else if (spanDays != null && (spanDays > GOOD_ALIGNMENT_SPAN_DAYS || durationKinds.size > 1)) confidence = 'medium';
  else confidence = 'high';

  if (annualizedFromQuarter && confidence === 'high') confidence = 'medium';
  return confidence;
}

function newestPeriod(inputs: ValuationInputMetric[]): string | null {
  const known = inputs
    .map((input) => input.periodEnd)
    .filter((period): period is string => Boolean(period))
    .sort();
  return known.length ? known[known.length - 1] : null;
}

function sourceRef(label: string, metric: ValuationInputMetric): ValuationSourceRef {
  return { label, periodEnd: metric.periodEnd, url: metric.sourceUrl };
}

function marketCapMissing(kind: ValuationAnchorKind): ValuationAnchor {
  return {
    kind,
    label: ANCHOR_LABELS[kind],
    status: 'insufficient_data',
    value: null,
    unit: null,
    basis: null,
    confidence: 'unknown',
    lastUpdated: null,
    sources: [],
    note: 'Market cap on teadmata; ilma selleta ei saa seda ankrut hinnata.',
  };
}

function evSalesAnchor(input: ValuationEvidenceInput, asOf: Date): ValuationAnchor {
  const kind: ValuationAnchorKind = 'ev_sales';
  if (input.marketCap == null) return marketCapMissing(kind);
  const sales = annualizeFlow(input.revenue);
  if (!sales || !input.cash || !input.debt) {
    const missing: string[] = [];
    if (!input.revenue) missing.push('revenue');
    else if (!sales) missing.push('annualiseeritav revenue (kvartal/aasta)');
    if (!input.cash) missing.push('cash');
    if (!input.debt) missing.push('debt');
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'insufficient_data',
      value: null, unit: null, basis: null, confidence: 'unknown', lastUpdated: null,
      sources: [], note: `EV / Sales vajab: ${missing.join(', ')}.`,
    };
  }
  const balanceDates = [input.cash.periodEnd, input.debt.periodEnd].map((date) => new Date(`${date}T00:00:00Z`).getTime());
  if (input.cash.periodEnd !== input.debt.periodEnd || balanceDates.some((date) =>
    !Number.isFinite(date) || date > asOf.getTime() || (asOf.getTime() - date) / 86_400_000 > STALE_FACT_DAYS)) {
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'insufficient_data',
      value: null, unit: null, basis: sales.basis, confidence: 'unknown',
      lastUpdated: newestPeriod([input.revenue!, input.cash, input.debt]),
      sources: [sourceRef('SEC cash', input.cash), sourceRef('SEC debt', input.debt)],
      note: 'EV / Sales unavailable: cash and debt must have the same, non-stale reporting date. Review the current filing; partial debt is not total debt.',
    };
  }
  const enterpriseValue = input.marketCap + input.debt.value - input.cash.value;
  if (sales.value <= 0) {
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'not_meaningful',
      value: null, unit: 'x', basis: sales.basis, confidence: 'unknown',
      lastUpdated: newestPeriod([input.revenue!, input.cash, input.debt]),
      sources: [sourceRef('SEC revenue', input.revenue!), sourceRef('SEC cash', input.cash), sourceRef('SEC debt', input.debt)],
      note: 'Annualiseeritud revenue ei ole positiivne; EV / Sales ei ole tähenduslik.',
    };
  }
  const usedInputs = [input.revenue!, input.cash, input.debt];
  return {
    kind, label: ANCHOR_LABELS[kind], status: 'computable',
    value: enterpriseValue / sales.value, unit: 'x', basis: sales.basis,
    confidence: inputsConfidence(usedInputs, asOf, sales.basis === 'annualized_from_quarter'),
    lastUpdated: newestPeriod(usedInputs),
    sources: [sourceRef('SEC revenue', input.revenue!), sourceRef('SEC cash', input.cash), sourceRef('SEC debt', input.debt)],
    note: input.debt.derived ? 'Debt on tuletatud (current + noncurrent).' : null,
  };
}

function peAnchor(input: ValuationEvidenceInput, asOf: Date): ValuationAnchor {
  const kind: ValuationAnchorKind = 'pe';
  if (input.marketCap == null) return marketCapMissing(kind);
  const earnings = annualizeFlow(input.netIncome);
  if (!earnings) {
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'insufficient_data',
      value: null, unit: null, basis: null, confidence: 'unknown', lastUpdated: null,
      sources: [], note: 'P / E vajab annualiseeritavat net income sisendit (kvartal/aasta).',
    };
  }
  if (earnings.value <= 0) {
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'not_meaningful',
      value: null, unit: 'x', basis: earnings.basis, confidence: 'unknown',
      lastUpdated: input.netIncome!.periodEnd,
      sources: [sourceRef('SEC net income', input.netIncome!)],
      note: 'Annualiseeritud kasum ei ole positiivne; P / E ei ole tähenduslik.',
    };
  }
  return {
    kind, label: ANCHOR_LABELS[kind], status: 'computable',
    value: input.marketCap / earnings.value, unit: 'x', basis: earnings.basis,
    confidence: inputsConfidence([input.netIncome!], asOf, earnings.basis === 'annualized_from_quarter'),
    lastUpdated: input.netIncome!.periodEnd,
    sources: [sourceRef('SEC net income', input.netIncome!)],
    note: null,
  };
}

function fcfYieldAnchor(input: ValuationEvidenceInput, asOf: Date): ValuationAnchor {
  const kind: ValuationAnchorKind = 'fcf_yield';
  if (input.marketCap == null) return marketCapMissing(kind);
  const fcf = annualizeFlow(input.freeCashFlow);
  if (!fcf) {
    return {
      kind, label: ANCHOR_LABELS[kind], status: 'insufficient_data',
      value: null, unit: null, basis: null, confidence: 'unknown', lastUpdated: null,
      sources: [], note: 'FCF Yield vajab annualiseeritavat free cash flow sisendit (kvartal/aasta).',
    };
  }
  const yieldPercent = (fcf.value / input.marketCap) * 100;
  return {
    kind, label: ANCHOR_LABELS[kind], status: 'computable',
    value: yieldPercent, unit: '%', basis: fcf.basis,
    confidence: inputsConfidence([input.freeCashFlow!], asOf, fcf.basis === 'annualized_from_quarter'),
    lastUpdated: input.freeCashFlow!.periodEnd,
    sources: [sourceRef('SEC free cash flow (tuletatud)', input.freeCashFlow!)],
    note: yieldPercent < 0 ? 'Negatiivne FCF Yield tähendab raha põletamist, mitte odavat hinda.' : null,
  };
}

// V1 ei arvuta peer valuation multiple'eid ega segmente. Need jäävad ausalt
// `unknown` ankruteks, mille investor täidab käsitsi Thesis Builderis.
function unknownAnchor(kind: ValuationAnchorKind, note: string): ValuationAnchor {
  return {
    kind, label: ANCHOR_LABELS[kind], status: 'unknown',
    value: null, unit: null, basis: null, confidence: 'unknown', lastUpdated: null,
    sources: [], note,
  };
}

export function calculateValuationEvidence(
  input: ValuationEvidenceInput,
  asOf = new Date(),
): ValuationEvidenceSummary {
  const anchors: ValuationAnchor[] = [
    evSalesAnchor(input, asOf),
    peAnchor(input, asOf),
    fcfYieldAnchor(input, asOf),
    unknownAnchor('peer_comparison', 'V1 ei arvuta peer valuation multiple\'eid; võrdlus on käsitsi tehtav.'),
    unknownAnchor('sum_of_parts', 'V1 ei tuleta segmente; sum-of-parts on käsitsi hüpotees.'),
  ];
  return {
    version: VALUATION_EVIDENCE_VERSION,
    marketCapKnown: input.marketCap != null,
    hasAnyComputable: anchors.some((anchor) => anchor.status === 'computable'),
    anchors,
  };
}

function toInput(metric: CompanyFinancialSummary['metrics'][keyof CompanyFinancialSummary['metrics']] | undefined): ValuationInputMetric | null {
  const point = metric?.latest;
  if (!point) return null;
  return {
    value: point.value,
    periodEnd: point.periodEnd || null,
    periodKind: point.periodKind || null,
    accessionNumber: point.accessionNumber || null,
    sourceUrl: point.sourceUrl || null,
    derived: point.derived,
  };
}

// Adapter: olemasolev CompanyFinancialSummary + market cap → valuation evidence.
// Puhas andmete ümberkujundamine, ei tee DB-päringut.
export function buildValuationEvidence(
  financials: CompanyFinancialSummary | null,
  marketCap: number | null,
  asOf = new Date(),
): ValuationEvidenceSummary {
  const metrics = financials?.metrics;
  return calculateValuationEvidence(
    {
      marketCap,
      revenue: toInput(metrics?.revenue),
      netIncome: toInput(metrics?.net_income),
      freeCashFlow: toInput(metrics?.free_cash_flow),
      cash: toInput(metrics?.cash),
      debt: toInput(metrics?.debt),
    },
    asOf,
  );
}
