import {
  calculateValuationEvidence,
  type ValuationAnchorKind,
  type ValuationBasis,
  type ValuationConfidence,
  type ValuationEvidenceInput,
  type ValuationInputMetric,
} from './valuation-evidence';

export const SCENARIO_VALUATION_VERSION = 'scenario-valuation-v1';

export type ScenarioCase = 'bear' | 'base' | 'bull';
export type ScenarioValuationStatus = 'available' | 'unavailable';

export interface ScenarioValuationCase {
  case: ScenarioCase;
  impliedPrice: number;
  upsideDownsidePercent: number;
  fundamentalChangePercent: number;
  valuationChangePercent: number;
  assumptions: string[];
}

export interface ScenarioValuation {
  version: typeof SCENARIO_VALUATION_VERSION;
  status: ScenarioValuationStatus;
  reason: string | null;
  currentPrice: number | null;
  anchorKind: ValuationAnchorKind | null;
  anchorLabel: string | null;
  anchorValue: number | null;
  anchorUnit: string | null;
  anchorBasis: ValuationBasis | null;
  confidence: ValuationConfidence;
  lastUpdated: string | null;
  scenarios: ScenarioValuationCase[];
}

const CASE_FACTORS: Array<{
  case: ScenarioCase;
  fundamental: number;
  valuation: number;
}> = [
  { case: 'bear', fundamental: 0.8, valuation: 0.8 },
  { case: 'base', fundamental: 1, valuation: 1 },
  { case: 'bull', fundamental: 1.2, valuation: 1.2 },
];

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function annualized(metric: ValuationInputMetric | null): number | null {
  if (!metric) return null;
  if (metric.periodKind === 'annual') return metric.value;
  if (metric.periodKind === 'quarter') return metric.value * 4;
  return null;
}

function unavailable(currentPrice: number | null, reason: string): ScenarioValuation {
  return {
    version: SCENARIO_VALUATION_VERSION,
    status: 'unavailable',
    reason,
    currentPrice,
    anchorKind: null,
    anchorLabel: null,
    anchorValue: null,
    anchorUnit: null,
    anchorBasis: null,
    confidence: 'unknown',
    lastUpdated: null,
    scenarios: [],
  };
}

function assumptions(
  scenario: ScenarioCase,
  anchorKind: ValuationAnchorKind,
  fundamentalLabel: string,
): string[] {
  if (scenario === 'base') {
    return [
      `${fundamentalLabel} stays at the latest annual or annualized level.`,
      `The current ${anchorKind === 'pe' ? 'P / E' : anchorKind === 'ev_sales' ? 'EV / Sales' : 'FCF yield'} valuation is unchanged.`,
    ];
  }
  const direction = scenario === 'bear' ? 'falls' : 'rises';
  if (anchorKind === 'fcf_yield') {
    return [
      `${fundamentalLabel} ${direction} 20%.`,
      scenario === 'bear'
        ? 'Required FCF yield rises 25%, reducing the valuation paid for cash flow.'
        : 'Required FCF yield falls 16.7%, increasing the valuation paid for cash flow.',
    ];
  }
  return [
    `${fundamentalLabel} ${direction} 20%.`,
    `The ${anchorKind === 'pe' ? 'P / E' : 'EV / Sales'} multiple ${scenario === 'bear' ? 'contracts' : 'expands'} 20%.`,
  ];
}

/**
 * Mechanical sensitivity, not a forecast. V1 deliberately keeps the business
 * and valuation shocks visible instead of hiding them in a price target.
 */
export function buildScenarioValuation(
  input: ValuationEvidenceInput,
  currentPrice: number | null,
  asOf = new Date(),
): ScenarioValuation {
  if (currentPrice == null || currentPrice <= 0) {
    return unavailable(currentPrice, 'Current decision price is unavailable.');
  }
  if (input.marketCap == null || input.marketCap <= 0) {
    return unavailable(currentPrice, 'Decision-time market cap is unavailable.');
  }

  const evidence = calculateValuationEvidence(input, asOf);
  const preferredKinds: ValuationAnchorKind[] = ['pe', 'ev_sales', 'fcf_yield'];
  const anchor = preferredKinds
    .map((kind) => evidence.anchors.find((item) => item.kind === kind))
    .find((item) => item?.status === 'computable' && item.value != null);
  if (!anchor || anchor.value == null || anchor.value <= 0) {
    return unavailable(currentPrice, 'No positive P / E, EV / Sales, or FCF yield anchor can be computed from the stored fundamentals.');
  }

  let fundamental: number | null = null;
  let fundamentalLabel = '';
  if (anchor.kind === 'pe') {
    fundamental = annualized(input.netIncome);
    fundamentalLabel = 'Net income';
  } else if (anchor.kind === 'ev_sales') {
    fundamental = annualized(input.revenue);
    fundamentalLabel = 'Revenue';
  } else {
    fundamental = annualized(input.freeCashFlow);
    fundamentalLabel = 'Free cash flow';
  }
  if (fundamental == null || fundamental <= 0) {
    return unavailable(currentPrice, `Positive annual or annualized ${fundamentalLabel.toLowerCase()} is unavailable.`);
  }

  const scenarios = CASE_FACTORS.flatMap((scenario): ScenarioValuationCase[] => {
    let targetMarketCap: number;
    if (anchor.kind === 'pe') {
      targetMarketCap = fundamental! * scenario.fundamental * anchor.value! * scenario.valuation;
    } else if (anchor.kind === 'ev_sales') {
      if (!input.cash || !input.debt) return [];
      const targetEnterpriseValue = fundamental! * scenario.fundamental * anchor.value! * scenario.valuation;
      targetMarketCap = targetEnterpriseValue - input.debt.value + input.cash.value;
    } else {
      const currentYield = anchor.value! / 100;
      const targetYield = currentYield / scenario.valuation;
      targetMarketCap = (fundamental! * scenario.fundamental) / targetYield;
    }
    if (!Number.isFinite(targetMarketCap) || targetMarketCap <= 0) return [];
    const impliedPrice = currentPrice * (targetMarketCap / input.marketCap!);
    return [{
      case: scenario.case,
      impliedPrice: rounded(impliedPrice),
      upsideDownsidePercent: rounded(((impliedPrice - currentPrice) / currentPrice) * 100),
      fundamentalChangePercent: rounded((scenario.fundamental - 1) * 100),
      valuationChangePercent: rounded((scenario.valuation - 1) * 100),
      assumptions: assumptions(scenario.case, anchor.kind, fundamentalLabel),
    }];
  });
  if (scenarios.length !== CASE_FACTORS.length) {
    return unavailable(currentPrice, 'The stored fundamentals do not support all three positive valuation sensitivities.');
  }

  return {
    version: SCENARIO_VALUATION_VERSION,
    status: 'available',
    reason: null,
    currentPrice,
    anchorKind: anchor.kind,
    anchorLabel: anchor.label,
    anchorValue: rounded(anchor.value),
    anchorUnit: anchor.unit,
    anchorBasis: anchor.basis,
    confidence: anchor.confidence,
    lastUpdated: anchor.lastUpdated,
    scenarios,
  };
}
