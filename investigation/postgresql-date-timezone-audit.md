# PostgreSQL DATE/TIMEZONE Audit Findings

**Audit Date:** 2026-08-18  
**Scope:** Read-only audit of PostgreSQL DATE handling where SQL DATE/TIMESTAMP values converted through JavaScript's Date object could shift by one day due to timezone handling (UTC vs Europe/Tallinn).

---

## Executive Summary

This audit identified **5 findings** related to date/timezone handling in the codebase. Three findings are **benign** (no functional impact), and two findings have **low-to-moderate severity** with potential for off-by-one-day errors under specific timezone conditions.

| Finding | File | Severity | Affects Shipped Feature |
|---------|------|----------|------------------------|
| F1 | `src/lib/date-only.ts` | Benign | No |
| F2 | `src/lib/collect.ts` | Low | Yes (captureDate) |
| F3 | `src/lib/outcome-coverage.ts` | Low | Yes (age bucket boundaries) |
| F4 | `src/lib/outcome-backfill-audit.ts` | Low | Yes (eligibility calculation) |
| F5 | `src/lib/date-only.ts` + `src/lib/db.ts` | Moderate | Yes (filed_at display) |

---

## Detailed Findings

### F1: `date-only.ts` uses `.toISOString()` on Date objects from PostgreSQL DATE columns

**File:** `src/lib/date-only.ts`  
**Lines:** 7-9, 16-18

```typescript
export function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Vigane DATE väärtus.');
    return value.toISOString().slice(0, 10);  // LINE 9
  }
  
  const text = String(value ?? '').trim();
  const exact = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (exact) return exact[1];
  
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Vigane DATE väärtus: ${text || '(tühi)'}`);
  return parsed.toISOString().slice(0, 10);  // LINE 18
}
```

**Actual Behavior:**
- When PostgreSQL returns a `DATE` column, node-postgres may parse it as a `Date` object with UTC midnight (00:00:00 UTC).
- Calling `.toISOString()` on a UTC midnight Date is safe and preserves the date.
- However, if the Date object is constructed from a string without explicit timezone info (line 16-18), JavaScript interprets it as **local time** (e.g., Europe/Tallinn UTC+3 in summer).
- Example: If server TZ=UTC and input text is `"2026-08-17"`, `new Date("2026-08-17")` creates `2026-08-17T00:00:00` in local time. If the server is in UTC, this is fine. But if the server runs in Europe/Tallinn, `new Date("2026-08-17")` is interpreted as Tallinn local time, which converts to `2026-08-16T21:00:00Z` in UTC, and `.toISOString().slice(0, 10)` returns `"2026-08-16"` — **off by one day**.

**Severity:** **Modererate** (currently benign because most inputs are already ISO strings from PostgreSQL, but the fallback path is vulnerable).

**Recommendation:** Scope a fix to always interpret DATE strings as UTC or use `Intl.DateTimeFormat` with explicit timeZone: 'UTC' before formatting.

---

### F2: `collect.ts` `today()` function uses local time without timezone specification

**File:** `src/lib/collect.ts`  
**Lines:** 30-35

```typescript
// Tänase kuupäev "YYYY-MM-DD" (lokaalne, ilma UTC-nihketa).
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

**Actual Behavior:**
- This function correctly extracts the **local calendar date** without timezone conversion.
- The comment explicitly states "lokaalne, ilma UTC-nihketa" (local, without UTC shift).
- This is **intentional behavior** for "Tallinn today" logic — it captures the calendar date in the server's local timezone.
- **Risk:** If the server runs in UTC but the business requirement is "Tallinn calendar date", then at 23:30 Europe/Tallinn (which is 20:30 UTC), `new Date()` returns UTC time, and `getDate()` returns the UTC day, not Tallinn day.

**Concrete Example:**
- Server TZ=UTC, local Tallinn time is `2026-08-17 23:30` (Europe/Tallinn +3).
- UTC time is `2026-08-17 20:30`.
- `new Date().getDate()` returns `17` (correct for both).
- But at Tallinn time `2026-08-18 01:00` (UTC `2026-08-17 22:00`):
  - Server in UTC computes `captureDate = "2026-08-17"`.
  - Expected Tallinn date is `2026-08-18`.
  - **Off by one day.**

**Severity:** **Low** (the script `scripts/collect-daily.cjs` line 41 uses `(now() AT TIME ZONE 'Europe/Tallinn')::date` for the canonical decision_date check, which is correct. But `captureDate` in collect.ts may diverge).

**Recommendation:** Scope a fix to use `Intl.DateTimeFormat` with `timeZone: 'Europe/Tallinn'` for consistency with the rest of the system's Tallinn-centric logic.

---

### F3: `outcome-coverage.ts` age bucket calculation uses `new Date(observedAt)` without timezone handling

**File:** `src/lib/outcome-coverage.ts`  
**Lines:** 63-72, 207

```typescript
function ageBucket(observedAt: string, now: Date): OutcomeAgeBucket {
  const observed = new Date(observedAt);  // LINE 64
  const ageDays = Number.isFinite(observed.getTime())
    ? Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000))
    : 0;
  if (ageDays <= 30) return '0-30 days';
  if (ageDays <= 90) return '31-90 days';
  if (ageDays <= 180) return '91-180 days';
  return '180+ days';
}

// ...

observedAt: row.observed_at == null ? null : new Date(row.observed_at).toISOString(),  // LINE 207
```

**Actual Behavior:**
- `observed_at` comes from PostgreSQL as a `TIMESTAMP WITH TIME ZONE` (timestamptz), which node-postgres converts to UTC.
- `new Date(observedAt)` where `observedAt` is an ISO string ending in `Z` (UTC) is safe.
- However, if `observed_at` is stored as `TIMESTAMP WITHOUT TIME ZONE` or the string lacks `Z`, JavaScript interprets it as **local time**.
- The age bucket boundaries (30D/90D/180D) are computed using millisecond differences, which is correct regardless of timezone.
- **Edge Case:** If `observedAt` is `"2026-08-17 00:00:00"` (no timezone), and server TZ=UTC, but the original value was meant to be Europe/Tallinn, the age calculation could be off by 3 hours, potentially affecting bucket boundaries near midnight.

**Severity:** **Low** (likely benign because `observed_at` in `collection_run_items` is stored via `.toISOString()` which includes timezone, but the read path should be audited).

**Recommendation:** Verify that `observed_at` is always stored and retrieved as timestamptz with explicit UTC. If any code path stores it as local time, scope a fix.

---

### F4: `outcome-backfill-audit.ts` age calculation mirrors F3

**File:** `src/lib/outcome-backfill-audit.ts`  
**Lines:** 101-105, 306

```typescript
function ageDays(observedAt: string, now: Date): number {
  const observed = new Date(observedAt);  // LINE 102
  if (!Number.isFinite(observed.getTime())) return -1;
  return Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000));
}

// ...

observedAt: new Date(row.observed_at).toISOString(),  // LINE 306
```

**Actual Behavior:**
- Same pattern as F3. Eligibility for 30D/90D/180D backfill is determined by comparing `ageDays(item.observedAt, now) >= horizon.days`.
- If `observed_at` has ambiguous timezone representation, eligibility could shift by one day near boundary conditions.

**Severity:** **Low** (same reasoning as F3).

**Recommendation:** Same as F3 — verify timestamptz usage throughout the pipeline.

---

### F5: `db.ts` filed_at conversion uses `.toISOString().slice(0, 10)` on a SQL DATE

**File:** `src/lib/db.ts`  
**Line:** 933

```typescript
filedAt: row.filed_at ? new Date(row.filed_at).toISOString().slice(0, 10) : null,
```

**Actual Behavior:**
- `filed_at` is a PostgreSQL `DATE` column (SEC filing date).
- PostgreSQL DATE values are returned by node-postgres as Date objects at UTC midnight.
- `new Date(row.filed_at)` where `row.filed_at` is already a Date object is redundant but harmless if the Date is UTC.
- However, if `filed_at` is returned as a string (e.g., `"2026-08-17"`), `new Date("2026-08-17")` interprets it as **local time**.
- `.toISOString().slice(0, 10)` then converts to UTC, potentially shifting the date.

**Concrete Example:**
- Server TZ=Europe/Tallinn (UTC+3).
- PostgreSQL returns `filed_at = "2026-08-17"` (string).
- `new Date("2026-08-17")` → `2026-08-17T00:00:00+03:00` (Tallinn local).
- `.toISOString()` → `2026-08-16T21:00:00.000Z`.
- `.slice(0, 10)` → `"2026-08-16"`.
- **Off by one day.**

**Severity:** **Moderate** (affects SEC filing date display, which is user-visible metadata).

**Recommendation:** Scope a fix to use `toDateOnly()` from `src/lib/date-only.ts` (after fixing F1) or explicitly parse DATE strings as UTC.

---

## Benign Findings

### B1: `discovery-validation.ts` and `today-brief.ts` use `Intl.DateTimeFormat` with explicit `timeZone: 'Europe/Tallinn'`

**Files:** `src/lib/discovery-validation.ts` (lines 157-164), `src/lib/today-brief.ts` (lines 267-274)

```typescript
function tallinnDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
```

**Assessment:** This is **correct** handling. The `timeZone` option ensures consistent Tallinn calendar date regardless of server timezone. No fix needed.

---

### B2: `discovery-validation.ts` horizonTarget uses UTC methods

**File:** `src/lib/discovery-validation.ts`  
**Lines:** 186-198

```typescript
function horizonTarget(runAt: Date, horizon: OutcomeHorizon): Date {
  const target = new Date(runAt);
  if (horizon === '1w') target.setUTCDate(target.getUTCDate() + 7);
  if (horizon === '2w') target.setUTCDate(target.getUTCDate() + 14);
  const months = horizon === '1m' ? 1 : horizon === '3m' ? 3 : horizon === '6m' ? 6 : 0;
  if (months) {
    const originalDay = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(originalDay, lastDay));
  }
  return target;
}
```

**Assessment:** This is **correct** UTC-based arithmetic. No fix needed.

---

## Summary of Recommendations

| Finding | Priority | Recommended Fix Scope |
|---------|----------|----------------------|
| F1 (`date-only.ts`) | Medium | Fix `toDateOnly()` to always interpret DATE strings as UTC or use `Intl.DateTimeFormat` with `timeZone: 'UTC'`. |
| F2 (`collect.ts` today()) | Low | Align `today()` with Tallinn timezone using `Intl.DateTimeFormat` for consistency with canonical discovery logic. |
| F3/F4 (outcome age buckets) | Low | Audit `observed_at` storage/retrieval to ensure timestamptz with explicit UTC throughout. |
| F5 (`db.ts` filed_at) | Medium | Use fixed `toDateOnly()` or explicit UTC parsing for DATE columns. |

---

## Files Requiring Follow-up Fixes

1. `src/lib/date-only.ts` — Fix timezone handling in `toDateOnly()`.
2. `src/lib/collect.ts` — Align `today()` with Tallinn timezone.
3. `src/lib/db.ts` — Use safe DATE conversion for `filed_at`.
4. `src/lib/outcome-coverage.ts` — Verify timestamptz usage (may be benign).
5. `src/lib/outcome-backfill-audit.ts` — Verify timestamptz usage (may be benign).

---

**Audit Status:** COMPLETE (read-only, no code changes made).
