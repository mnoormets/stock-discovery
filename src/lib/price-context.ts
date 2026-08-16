export const PRICE_CONTEXT_VERSION = 'price-context-v1';

export const RECENT_RUN_UP_THRESHOLDS = {
  oneMonthPercent: 20,
  threeMonthPercent: 35,
  sixMonthPercent: 50,
} as const;

const DAY_MS = 86_400_000;
const RETURN_REFERENCE_TOLERANCE_DAYS = 7;
const YEAR_REFERENCE_TOLERANCE_DAYS = 14;

export interface StoredPriceObservation {
  price: number;
  capturedAt: string;
}

export type PriceHistoryStatus = 'sufficient' | 'partial' | 'insufficient';

export interface CandidatePriceContext {
  version: typeof PRICE_CONTEXT_VERSION;
  asOf: string;
  currentPrice: number | null;
  oneMonthReturnPercent: number | null;
  threeMonthReturnPercent: number | null;
  sixMonthReturnPercent: number | null;
  distanceFrom52WeekHighPercent: number | null;
  distanceFrom52WeekLowPercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  historyStatus: PriceHistoryStatus;
  observationCount: number;
  oldestObservationAt: string | null;
  newestObservationAt: string | null;
  recentRunUp: boolean;
  recentRunUpReasons: string[];
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function validTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function referencePrice(
  points: Array<StoredPriceObservation & { timestamp: number }>,
  targetTimestamp: number,
  toleranceDays: number,
): number | null {
  const toleranceMs = toleranceDays * DAY_MS;
  const nearest = points
    .map((point) => ({ point, distance: Math.abs(point.timestamp - targetTimestamp) }))
    .filter((item) => item.distance <= toleranceMs)
    .sort((a, b) => a.distance - b.distance || b.point.timestamp - a.point.timestamp)[0];
  return nearest?.point.price ?? null;
}

function returnPercent(currentPrice: number, reference: number | null): number | null {
  if (reference == null || reference <= 0) return null;
  return rounded(((currentPrice - reference) / reference) * 100);
}

export function buildPriceContext(input: {
  asOf: string | Date;
  currentPrice: number | null;
  observations: StoredPriceObservation[];
}): CandidatePriceContext {
  const asOfDate = input.asOf instanceof Date ? input.asOf : new Date(input.asOf);
  const asOfTimestamp = asOfDate.getTime();
  const asOf = Number.isFinite(asOfTimestamp) ? asOfDate.toISOString() : new Date(0).toISOString();
  const currentPrice = input.currentPrice != null && input.currentPrice > 0 ? input.currentPrice : null;
  const points = input.observations
    .flatMap((observation) => {
      const timestamp = validTimestamp(observation.capturedAt);
      return timestamp != null
        && timestamp <= asOfTimestamp
        && observation.price > 0
        ? [{ ...observation, timestamp }]
        : [];
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const oldestObservationAt = points[0]?.capturedAt || null;
  const newestObservationAt = points.at(-1)?.capturedAt || null;
  if (currentPrice == null || !Number.isFinite(asOfTimestamp)) {
    return {
      version: PRICE_CONTEXT_VERSION,
      asOf,
      currentPrice,
      oneMonthReturnPercent: null,
      threeMonthReturnPercent: null,
      sixMonthReturnPercent: null,
      distanceFrom52WeekHighPercent: null,
      distanceFrom52WeekLowPercent: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      historyStatus: 'insufficient',
      observationCount: points.length,
      oldestObservationAt,
      newestObservationAt,
      recentRunUp: false,
      recentRunUpReasons: [],
    };
  }

  const oneMonthReturnPercent = returnPercent(
    currentPrice,
    referencePrice(points, asOfTimestamp - 30 * DAY_MS, RETURN_REFERENCE_TOLERANCE_DAYS),
  );
  const threeMonthReturnPercent = returnPercent(
    currentPrice,
    referencePrice(points, asOfTimestamp - 90 * DAY_MS, RETURN_REFERENCE_TOLERANCE_DAYS),
  );
  const sixMonthReturnPercent = returnPercent(
    currentPrice,
    referencePrice(points, asOfTimestamp - 180 * DAY_MS, RETURN_REFERENCE_TOLERANCE_DAYS),
  );

  const yearStart = asOfTimestamp - 365 * DAY_MS;
  const hasYearReference = referencePrice(points, yearStart, YEAR_REFERENCE_TOLERANCE_DAYS) != null;
  const yearPoints = hasYearReference
    ? points.filter((point) => point.timestamp >= yearStart && point.timestamp <= asOfTimestamp)
    : [];
  const yearPrices = [...yearPoints.map((point) => point.price), currentPrice];
  const fiftyTwoWeekHigh = hasYearReference ? Math.max(...yearPrices) : null;
  const fiftyTwoWeekLow = hasYearReference ? Math.min(...yearPrices) : null;
  const distanceFrom52WeekHighPercent = fiftyTwoWeekHigh == null
    ? null
    : rounded(((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100);
  const distanceFrom52WeekLowPercent = fiftyTwoWeekLow == null
    ? null
    : rounded(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100);

  const availableMetricCount = [
    oneMonthReturnPercent,
    threeMonthReturnPercent,
    sixMonthReturnPercent,
    distanceFrom52WeekHighPercent,
    distanceFrom52WeekLowPercent,
  ].filter((value) => value != null).length;
  const historyStatus: PriceHistoryStatus = availableMetricCount === 5
    ? 'sufficient'
    : availableMetricCount === 0 ? 'insufficient' : 'partial';

  const recentRunUpReasons: string[] = [];
  if (oneMonthReturnPercent != null && oneMonthReturnPercent >= RECENT_RUN_UP_THRESHOLDS.oneMonthPercent) {
    recentRunUpReasons.push(`1-month return is +${oneMonthReturnPercent.toFixed(1)}%`);
  }
  if (threeMonthReturnPercent != null && threeMonthReturnPercent >= RECENT_RUN_UP_THRESHOLDS.threeMonthPercent) {
    recentRunUpReasons.push(`3-month return is +${threeMonthReturnPercent.toFixed(1)}%`);
  }
  if (sixMonthReturnPercent != null && sixMonthReturnPercent >= RECENT_RUN_UP_THRESHOLDS.sixMonthPercent) {
    recentRunUpReasons.push(`6-month return is +${sixMonthReturnPercent.toFixed(1)}%`);
  }

  return {
    version: PRICE_CONTEXT_VERSION,
    asOf,
    currentPrice,
    oneMonthReturnPercent,
    threeMonthReturnPercent,
    sixMonthReturnPercent,
    distanceFrom52WeekHighPercent,
    distanceFrom52WeekLowPercent,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    historyStatus,
    observationCount: points.length,
    oldestObservationAt,
    newestObservationAt,
    recentRunUp: recentRunUpReasons.length > 0,
    recentRunUpReasons,
  };
}
