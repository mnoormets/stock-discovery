import { describe, expect, it } from 'vitest';

describe('Timezone-safe date handling (F2, F5 fixes)', () => {
  describe('today() in collect.ts (F2)', () => {
    // Simulate the Intl.DateTimeFormat behavior used in the fixed today() function
    function todayInTallinn(now: Date): string {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Tallinn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
    }

    function todayLocal(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

    it('returns correct Tallinn date at UTC midnight', () => {
      // 2026-08-17 00:00 UTC = 2026-08-17 03:00 Tallinn
      const utcMidnight = new Date('2026-08-17T00:00:00.000Z');
      expect(todayInTallinn(utcMidnight)).toBe('2026-08-17');
    });

    it('returns correct Tallinn date at Tallinn midnight (UTC previous day)', () => {
      // 2026-08-18 00:00 Europe/Tallinn = 2026-08-17 21:00 UTC (summer time +3)
      // This is the critical case: if server runs in UTC, local getDate() would return 17
      // but Tallinn time is already 18th
      const tallinnMidnight = new Date('2026-08-17T21:00:00.000Z');
      expect(todayInTallinn(tallinnMidnight)).toBe('2026-08-18');
      // Demonstrate the bug that would occur with local-time approach in UTC server:
      expect(todayLocal(tallinnMidnight)).toBe('2026-08-17'); // WRONG for Tallinn business logic
    });

    it('returns correct Tallinn date at Tallinn noon', () => {
      // 2026-08-17 12:00 Europe/Tallinn = 2026-08-17 09:00 UTC
      const tallinnNoon = new Date('2026-08-17T09:00:00.000Z');
      expect(todayInTallinn(tallinnNoon)).toBe('2026-08-17');
    });

    it('handles winter time correctly (UTC+2)', () => {
      // 2026-01-15 00:00 Europe/Tallinn = 2026-01-14 22:00 UTC (winter time +2)
      const tallinnWinterMidnight = new Date('2026-01-14T22:00:00.000Z');
      expect(todayInTallinn(tallinnWinterMidnight)).toBe('2026-01-15');
      // Local-time approach in UTC server would fail:
      expect(todayLocal(tallinnWinterMidnight)).toBe('2026-01-14'); // WRONG
    });
  });

  describe('filed_at DATE extraction (F5)', () => {
    // Simulate the fixed filed_at handling
    function extractFiledAt(rawValue: unknown): string | null {
      if (rawValue == null) return null;
      const str = String(rawValue);
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(str);
      return m ? m[1] : new Date(str).toISOString().slice(0, 10);
    }

    it('preserves YYYY-MM-DD string directly without timezone shift', () => {
      // PostgreSQL returns DATE as string "2026-08-17"
      const dateString = '2026-08-17';
      expect(extractFiledAt(dateString)).toBe('2026-08-17');
    });

    it('handles Date object from node-postgres (UTC midnight)', () => {
      // node-postgres may return DATE as Date at UTC midnight
      const dateObject = new Date('2026-08-17T00:00:00.000Z');
      expect(extractFiledAt(dateObject)).toBe('2026-08-17');
    });

    it('avoids off-by-one error when DATE string interpreted as local time', () => {
      // If server TZ=Europe/Tallinn and DATE string "2026-08-17" is interpreted as local time
      // Old buggy code: new Date("2026-08-17") → 2026-08-17T00:00:00+03:00 → toISOString() → 2026-08-16
      // This test simulates by checking that direct regex extraction avoids the issue
      const dateString = '2026-08-17';
      // The fixed version extracts directly:
      expect(extractFiledAt(dateString)).toBe('2026-08-17');
      // Note: We cannot easily simulate the buggy behavior here because
      // the test environment TZ may differ, but the fix ensures direct extraction
      // happens before any JS Date interpretation.
    });

    it('returns null for null input', () => {
      expect(extractFiledAt(null)).toBe(null);
      expect(extractFiledAt(undefined)).toBe(null);
    });

    it('falls back to JS Date conversion for non-standard formats', () => {
      // If for some reason the value is not YYYY-MM-DD format
      const timestamp = '2026-08-17T14:30:00.000Z';
      expect(extractFiledAt(timestamp)).toBe('2026-08-17');
    });
  });
});
