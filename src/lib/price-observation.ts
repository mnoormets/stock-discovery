const DAY_MS = 86_400_000;
const newYorkFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
const newYorkTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Published NYSE full-day closures for the years currently listed by the
// exchange. Keeping the dates explicit makes the accepted observation window
// auditable and fails back to the conservative weekday rule outside this set.
// https://www.nyse.com/trade/hours-calendars
const KNOWN_NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
]);

export function newYorkPriceDate(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? newYorkFormatter.format(date) : null;
}

/** True only during an expected full-day NYSE regular session. */
export function isExpectedNewYorkRegularSession(value: string | Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const dateOnly = newYorkPriceDate(date.toISOString());
  if (!dateOnly || KNOWN_NYSE_HOLIDAYS.has(dateOnly)) return false;
  const weekday = new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const parts = newYorkTimeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/**
 * Read-side observation-age heuristic, not an execution rule. Allow one elapsed
 * New York trading day. Weekends and explicitly published 2026-2028 NYSE
 * holidays add no days. Missing/future timestamps cannot establish recency.
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
  let tradingDays = 0;
  for (let day = start + DAY_MS; day <= end; day += DAY_MS) {
    const date = new Date(day);
    const weekday = date.getUTCDay();
    const dateOnly = date.toISOString().slice(0, 10);
    if (weekday !== 0 && weekday !== 6 && !KNOWN_NYSE_HOLIDAYS.has(dateOnly)) tradingDays += 1;
  }
  return tradingDays <= 1 ? 'recent' : 'stale';
}
