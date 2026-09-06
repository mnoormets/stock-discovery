const DAY_MS = 86_400_000;
const newYorkFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function newYorkPriceDate(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? newYorkFormatter.format(date) : null;
}

/**
 * Read-side observation-age heuristic, not an exchange calendar or an execution
 * rule. Allow one elapsed New York weekday; weekends add no days. Holidays are
 * deliberately not inferred. Missing/future timestamps cannot establish recency.
 */
export function priceObservationRecency(
  observedAt: string | null,
  asOf: string,
): 'recent' | 'stale' | 'unknown' {
  if (!observedAt) return 'unknown';
  const observed = new Date(observedAt).getTime();
  const current = new Date(asOf).getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(current) || observed > current) return 'unknown';
  const start = new Date(`${newYorkPriceDate(observedAt)}T00:00:00Z`).getTime();
  const end = new Date(`${newYorkPriceDate(asOf)}T00:00:00Z`).getTime();
  if (end - start > 4 * DAY_MS) return 'stale';
  let weekdays = 0;
  for (let day = start + DAY_MS; day <= end; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) weekdays += 1;
  }
  return weekdays <= 1 ? 'recent' : 'stale';
}
