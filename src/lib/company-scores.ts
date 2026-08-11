import type { CompanyFinancialSummary, FinancialMetricSummary } from './company-financials';

export const SCORE_VERSION = 'scores-v1';

export type CompanyScoreKind = 'growth' | 'financial_health' | 'coverage';

export interface ScoreComponent {
  id: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface CompanyScore {
  kind: CompanyScoreKind;
  score: number;
  label: string;
  coveragePercent: number;
  components: ScoreComponent[];
}

export interface CompanyScores {
  growth: CompanyScore | null;
  financialHealth: CompanyScore | null;
  coverage: CompanyScore;
}

export interface ScoreReason {
  componentId: string;
  label: string;
  direction: 'positive' | 'negative' | 'neutral';
  detail: string;
  componentScore: number;
  weight: number;
  weightedInfluence: number;
}

export function getTopScoreReasons(score: CompanyScore | null, limit = 3): ScoreReason[] {
  if (!score || score.kind === 'coverage' || limit <= 0) return [];
  return score.components
    .map((component) => {
      const weightedInfluence = Math.round(((component.score - 50) * component.weight / 100) * 10) / 10;
      return {
        componentId: component.id,
        label: component.label,
        direction: component.score >= 65 ? 'positive' as const : component.score < 40 ? 'negative' as const : 'neutral' as const,
        detail: component.detail,
        componentScore: component.score,
        weight: component.weight,
        weightedInfluence,
      };
    })
    .sort((a, b) => Math.abs(b.weightedInfluence) - Math.abs(a.weightedInfluence) || b.weight - a.weight)
    .slice(0, limit);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function rounded(value: number): number {
  return Math.round(clamp(value));
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Tugev';
  if (score >= 65) return 'Hea';
  if (score >= 50) return 'Keskmine';
  if (score >= 35) return 'Nõrk';
  return 'Väga nõrk';
}

function coverageLabel(score: number): string {
  if (score >= 90) return 'Väga hea kate';
  if (score >= 70) return 'Hea kate';
  if (score >= 40) return 'Osaline kate';
  return 'Napp kate';
}

function percent(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('et-EE', { maximumFractionDigits: 1 })}%`;
}

function growthRateScore(rate: number): number {
  if (rate >= 30) return 100;
  if (rate >= 20) return 85 + ((rate - 20) / 10) * 15;
  if (rate >= 10) return 70 + ((rate - 10) / 10) * 15;
  if (rate >= 0) return 50 + (rate / 10) * 20;
  if (rate >= -10) return 30 + ((rate + 10) / 10) * 20;
  if (rate >= -30) return ((rate + 30) / 20) * 30;
  return 0;
}

function finalize(kind: CompanyScoreKind, components: ScoreComponent[], totalPossibleWeight: number): CompanyScore | null {
  if (components.length === 0) return null;
  const availableWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weightedScore = components.reduce((sum, component) => sum + component.score * component.weight, 0) / availableWeight;
  const score = rounded(weightedScore);
  return {
    kind,
    score,
    label: scoreLabel(score),
    coveragePercent: Math.round((availableWeight / totalPossibleWeight) * 100),
    components,
  };
}

function growthComponent(id: string, label: string, summary: FinancialMetricSummary | undefined, weight: number): ScoreComponent | null {
  const yoy = summary?.yearOverYearPercent;
  if (yoy == null) return null;
  return { id, label, score: rounded(growthRateScore(yoy)), weight, detail: `${percent(yoy)} YoY` };
}

function flowHealth(summary: FinancialMetricSummary, label: string): { score: number; detail: string } {
  const value = summary.latest.value;
  const yoy = summary.yearOverYearPercent;
  if (value >= 0 && (yoy == null || yoy >= 0)) return { score: 100, detail: `${label} on positiivne${yoy == null ? '' : ` ja ${percent(yoy)} YoY`}` };
  if (value >= 0) return { score: 70, detail: `${label} on positiivne, kuid ${percent(yoy!)} YoY` };
  if (yoy != null && yoy > 0) return { score: 35, detail: `${label} on negatiivne, kuid paranes ${percent(yoy)} YoY` };
  return { score: 0, detail: `${label} on negatiivne${yoy == null ? '' : ` ja ${percent(yoy)} YoY`}` };
}

function cashDebtComponent(financials: CompanyFinancialSummary): ScoreComponent | null {
  const cash = financials.metrics.cash?.latest.value;
  const debt = financials.metrics.debt?.latest.value;
  if (cash == null || debt == null) return null;
  if (debt <= 0) return { id: 'cash_debt', label: 'Cash / debt', score: 100, weight: 30, detail: 'Raporteeritud võlg puudub või on null' };
  const ratio = cash / debt;
  let score: number;
  if (ratio >= 2) score = 100;
  else if (ratio >= 1) score = 80 + (ratio - 1) * 20;
  else if (ratio >= 0.5) score = 55 + ((ratio - 0.5) / 0.5) * 25;
  else if (ratio >= 0.25) score = 30 + ((ratio - 0.25) / 0.25) * 25;
  else score = (ratio / 0.25) * 30;
  return { id: 'cash_debt', label: 'Cash / debt', score: rounded(score), weight: 30, detail: `${ratio.toLocaleString('et-EE', { maximumFractionDigits: 2 })}×` };
}

function incomeComponent(summary: FinancialMetricSummary): ScoreComponent {
  const positive = summary.latest.value >= 0;
  const yoy = summary.yearOverYearPercent;
  let score = positive ? 75 : 10;
  if (yoy != null) {
    if (positive && yoy >= 0) score = 100;
    else if (positive) score = 60;
    else if (yoy > 0) score = 40;
    else score = 0;
  }
  return {
    id: 'net_income_health', label: 'Net income', score, weight: 15,
    detail: `${positive ? 'Positiivne' : 'Negatiivne'}${yoy == null ? '' : ` · ${percent(yoy)} YoY`}`,
  };
}

function dilutionComponent(summary: FinancialMetricSummary): ScoreComponent | null {
  const yoy = summary.yearOverYearPercent;
  if (yoy == null) return null;
  let score: number;
  if (yoy <= 0) score = 100;
  else if (yoy < 2) score = 85;
  else if (yoy < 5) score = 60;
  else if (yoy < 10) score = 30;
  else score = 0;
  return { id: 'dilution', label: 'Aktsiate arv', score, weight: 15, detail: `${percent(yoy)} YoY` };
}

export function calculateCompanyScores(financials: CompanyFinancialSummary | null): CompanyScores {
  if (!financials) {
    return {
      growth: null,
      financialHealth: null,
      coverage: {
        kind: 'coverage', score: 0, label: coverageLabel(0), coveragePercent: 0,
        components: [
          { id: 'growth_coverage', label: 'Growth sisendid', score: 0, weight: 50, detail: '0/4 komponenti' },
          { id: 'health_coverage', label: 'Financial Health sisendid', score: 0, weight: 50, detail: '0/5 komponenti' },
        ],
      },
    };
  }
  const growthComponents = [
    growthComponent('revenue_growth', 'Revenue kasv', financials.metrics.revenue, 50),
    growthComponent('net_income_growth', 'Net income kasv', financials.metrics.net_income, 20),
    growthComponent('ocf_growth', 'Operating cash flow kasv', financials.metrics.operating_cash_flow, 15),
    growthComponent('fcf_growth', 'Free cash flow kasv', financials.metrics.free_cash_flow, 15),
  ].filter((component): component is ScoreComponent => Boolean(component));

  const healthComponents: ScoreComponent[] = [];
  const fcf = financials.metrics.free_cash_flow;
  if (fcf) {
    const result = flowHealth(fcf, 'FCF');
    healthComponents.push({ id: 'fcf_health', label: 'Free cash flow', score: result.score, weight: 25, detail: result.detail });
  }
  const ocf = financials.metrics.operating_cash_flow;
  if (ocf) {
    const result = flowHealth(ocf, 'OCF');
    healthComponents.push({ id: 'ocf_health', label: 'Operating cash flow', score: result.score, weight: 15, detail: result.detail });
  }
  const cashDebt = cashDebtComponent(financials);
  if (cashDebt) healthComponents.push(cashDebt);
  const income = financials.metrics.net_income;
  if (income) healthComponents.push(incomeComponent(income));
  const dilution = financials.metrics.shares_outstanding && dilutionComponent(financials.metrics.shares_outstanding);
  if (dilution) healthComponents.push(dilution);

  const growth = finalize('growth', growthComponents, 100);
  const financialHealth = finalize('financial_health', healthComponents, 100);
  const growthCoverage = growth?.coveragePercent ?? 0;
  const healthCoverage = financialHealth?.coveragePercent ?? 0;
  const coverageScore = rounded((growthCoverage + healthCoverage) / 2);
  return {
    growth,
    financialHealth,
    coverage: {
      kind: 'coverage',
      score: coverageScore,
      label: coverageLabel(coverageScore),
      coveragePercent: coverageScore,
      components: [
        { id: 'growth_coverage', label: 'Growth sisendid', score: growthCoverage, weight: 50, detail: `${growthComponents.length}/4 komponenti` },
        { id: 'health_coverage', label: 'Financial Health sisendid', score: healthCoverage, weight: 50, detail: `${healthComponents.length}/5 komponenti` },
      ],
    },
  };
}
