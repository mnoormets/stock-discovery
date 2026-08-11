import type {
  CompanyFinancialSummary,
  FinancialMetric,
  FinancialPeriodKind,
} from './company-financials';

export const DATA_QUALITY_VERSION = 'data-quality-v1';
export const STALE_FACT_DAYS = 550;
export const GOOD_ALIGNMENT_SPAN_DAYS = 120;
export const POOR_ALIGNMENT_SPAN_DAYS = 730;

export const DATA_QUALITY_METRICS: FinancialMetric[] = [
  'revenue',
  'net_income',
  'operating_cash_flow',
  'free_cash_flow',
  'cash',
  'debt',
  'shares_outstanding',
];

export type FreshnessStatus = 'fresh' | 'mixed' | 'stale' | 'unknown';
export type AlignmentStatus = 'good' | 'warning' | 'poor' | 'unknown';

export interface DataQualityMetricInput {
  metric: FinancialMetric;
  value: number;
  unit: string;
  periodEnd: string | null;
  periodKind: FinancialPeriodKind | null;
  factId: number | null;
  accessionNumber: string | null;
  sourceUrl: string | null;
}

export interface MetricDataQuality extends DataQualityMetricInput {
  factAgeDays: number | null;
  periodKnown: boolean;
  stale: boolean;
}

export interface DataQualitySummary {
  version: typeof DATA_QUALITY_VERSION;
  metrics: MetricDataQuality[];
  newestPeriodEnd: string | null;
  oldestPeriodEnd: string | null;
  oldestMetric: FinancialMetric | null;
  medianFactAgeDays: number | null;
  staleMetricCount: number;
  unknownPeriodCount: number;
  periodSpanDays: number | null;
  freshnessStatus: FreshnessStatus;
  alignmentStatus: AlignmentStatus;
  mixedDurationPeriods: boolean;
  warnings: string[];
}

const DAY_MS = 86_400_000;

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

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function calculateDataQualityFromMetrics(
  inputs: DataQualityMetricInput[],
  asOf = new Date(),
): DataQualitySummary {
  const metrics = inputs.map((input): MetricDataQuality => {
    const factAgeDays = ageInDays(input.periodEnd, asOf);
    return {
      ...input,
      factAgeDays,
      periodKnown: factAgeDays != null,
      stale: factAgeDays != null && factAgeDays > STALE_FACT_DAYS,
    };
  });
  const known = metrics
    .filter((metric) => metric.periodKnown)
    .sort((a, b) => parsePeriod(a.periodEnd)! - parsePeriod(b.periodEnd)!);
  const oldest = known[0] || null;
  const newest = known[known.length - 1] || null;
  const periodSpanDays = known.length >= 2 && oldest && newest
    ? Math.round((parsePeriod(newest.periodEnd)! - parsePeriod(oldest.periodEnd)!) / DAY_MS)
    : null;
  const staleMetricCount = metrics.filter((metric) => metric.stale).length;
  const unknownPeriodCount = metrics.filter((metric) => !metric.periodKnown).length;
  const durationKinds = new Set(
    known
      .map((metric) => metric.periodKind)
      .filter((kind): kind is Exclude<FinancialPeriodKind, 'instant'> => Boolean(kind && kind !== 'instant')),
  );
  const mixedDurationPeriods = durationKinds.size > 1;

  let freshnessStatus: FreshnessStatus;
  if (known.length === 0) freshnessStatus = 'unknown';
  else if (staleMetricCount === known.length) freshnessStatus = 'stale';
  else if (staleMetricCount > 0 || unknownPeriodCount > 0) freshnessStatus = 'mixed';
  else freshnessStatus = 'fresh';

  let alignmentStatus: AlignmentStatus;
  if (known.length < 2) alignmentStatus = 'unknown';
  else if (periodSpanDays != null && periodSpanDays > POOR_ALIGNMENT_SPAN_DAYS) alignmentStatus = 'poor';
  else if (
    (periodSpanDays != null && periodSpanDays > GOOD_ALIGNMENT_SPAN_DAYS)
    || mixedDurationPeriods
    || unknownPeriodCount > 0
  ) alignmentStatus = 'warning';
  else alignmentStatus = 'good';

  const warnings: string[] = [];
  if (staleMetricCount > 0) {
    warnings.push(`${staleMetricCount} skoorisisendit on vanemad kui ${STALE_FACT_DAYS} päeva.`);
  }
  if (unknownPeriodCount > 0) warnings.push(`${unknownPeriodCount} sisendi periood on teadmata.`);
  if (alignmentStatus === 'poor' && oldest && newest) {
    warnings.push(`Sisendid ei ole ajaliselt võrreldavad: ${oldest.metric} ${oldest.periodEnd} vs ${newest.metric} ${newest.periodEnd}.`);
  } else if (periodSpanDays != null && periodSpanDays > GOOD_ALIGNMENT_SPAN_DAYS && oldest && newest) {
    warnings.push(`Sisendite perioodivahe on ${periodSpanDays} päeva: ${oldest.metric} ${oldest.periodEnd} vs ${newest.metric} ${newest.periodEnd}.`);
  }
  if (mixedDurationPeriods) {
    warnings.push(`Samas pildis on eri kestusega perioodid: ${[...durationKinds].join(', ')}.`);
  }

  return {
    version: DATA_QUALITY_VERSION,
    metrics,
    newestPeriodEnd: newest?.periodEnd || null,
    oldestPeriodEnd: oldest?.periodEnd || null,
    oldestMetric: oldest?.metric || null,
    medianFactAgeDays: median(known.flatMap((metric) => metric.factAgeDays == null ? [] : [metric.factAgeDays])),
    staleMetricCount,
    unknownPeriodCount,
    periodSpanDays,
    freshnessStatus,
    alignmentStatus,
    mixedDurationPeriods,
    warnings,
  };
}

export function calculateDataQuality(
  financials: CompanyFinancialSummary | null,
  asOf = new Date(),
): DataQualitySummary {
  if (!financials) return calculateDataQualityFromMetrics([], asOf);
  const inputs = DATA_QUALITY_METRICS.flatMap((metric): DataQualityMetricInput[] => {
    const point = financials.metrics[metric]?.latest;
    if (!point) return [];
    return [{
      metric,
      value: point.value,
      unit: point.unit,
      periodEnd: point.periodEnd || null,
      periodKind: point.periodKind || null,
      factId: point.id,
      accessionNumber: point.accessionNumber || null,
      sourceUrl: point.sourceUrl || null,
    }];
  });
  return calculateDataQualityFromMetrics(inputs, asOf);
}

export function hasDataQualityWarning(summary: DataQualitySummary): boolean {
  return summary.freshnessStatus !== 'fresh' || summary.alignmentStatus !== 'good';
}

