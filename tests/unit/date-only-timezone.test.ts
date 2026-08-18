import { describe, it, expect } from 'vitest';
import { toDateOnly } from '../../src/lib/date-only';

describe('toDateOnly - F1 timezone fix', () => {
  describe('DATE string inputs', () => {
    it('preserves YYYY-MM-DD string without timezone shift', () => {
      // This was the bug: "2026-08-17" could become "2026-08-16" if interpreted as local time then converted to UTC
      expect(toDateOnly('2026-08-17')).toBe('2026-08-17');
      expect(toDateOnly('2024-01-01')).toBe('2024-01-01');
      expect(toDateOnly('2024-12-31')).toBe('2024-12-31');
    });

    it('handles DATE strings with extra whitespace', () => {
      expect(toDateOnly('  2024-06-15  ')).toBe('2024-06-15');
    });

    it('handles null/undefined gracefully', () => {
      expect(toDateOnly(null)).toBe('');
      expect(toDateOnly(undefined)).toBe('');
      expect(toDateOnly('')).toBe('');
    });
  });

  describe('Date object inputs', () => {
    it('extracts calendar date components without UTC conversion', () => {
      // Create a Date representing 2024-06-15 in local time
      const date = new Date(2024, 5, 15); // Month is 0-indexed (5 = June)
      expect(toDateOnly(date)).toBe('2024-06-15');
    });

    it('handles year boundaries correctly', () => {
      const jan1 = new Date(2024, 0, 1);
      expect(toDateOnly(jan1)).toBe('2024-01-01');

      const dec31 = new Date(2024, 11, 31);
      expect(toDateOnly(dec31)).toBe('2024-12-31');
    });

    it('handles leap year dates', () => {
      const feb29 = new Date(2024, 1, 29); // 2024 is a leap year
      expect(toDateOnly(feb29)).toBe('2024-02-29');
    });
  });

  describe('timezone edge cases - Europe/Tallinn vs UTC', () => {
    it('preserves date when server TZ differs from Europe/Tallinn', () => {
      // Simulate the scenario where UTC and Tallinn disagree on the day
      // At 2024-06-15 22:00 UTC, it's already 2024-06-16 01:00 in Tallinn (UTC+3)
      // The old code using toISOString() would shift this
      
      // Create a Date that would be problematic with toISOString()
      // If we're in Tallinn timezone and it's late evening, toISOString() goes to next day UTC
      const lateEvening = new Date(2024, 5, 15, 23, 0, 0); // 23:00 local time
      expect(toDateOnly(lateEvening)).toBe('2024-06-15');
      
      // Early morning should also work
      const earlyMorning = new Date(2024, 5, 16, 1, 0, 0); // 01:00 local time
      expect(toDateOnly(earlyMorning)).toBe('2024-06-16');
    });

    it('handles midnight boundary correctly', () => {
      // Just before midnight
      const beforeMidnight = new Date(2024, 5, 15, 23, 59, 59);
      expect(toDateOnly(beforeMidnight)).toBe('2024-06-15');
      
      // Just after midnight
      const afterMidnight = new Date(2024, 5, 16, 0, 0, 1);
      expect(toDateOnly(afterMidnight)).toBe('2024-06-16');
    });

    it('handles summer/winter time transitions', () => {
      // Estonia switches between EET (UTC+2) and EEST (UTC+3)
      // Winter time (EET, UTC+2)
      const winterDate = new Date(2024, 0, 15, 12, 0, 0); // January 15, noon
      expect(toDateOnly(winterDate)).toBe('2024-01-15');
      
      // Summer time (EEST, UTC+3)
      const summerDate = new Date(2024, 6, 15, 12, 0, 0); // July 15, noon
      expect(toDateOnly(summerDate)).toBe('2024-07-15');
    });
  });

  describe('ISO string parsing', () => {
    it('parses ISO date strings correctly', () => {
      // ISO strings with time component
      expect(toDateOnly('2024-06-15T10:30:00.000Z')).toBe('2024-06-15');
      expect(toDateOnly('2024-06-15T23:59:59.999Z')).toBe('2024-06-15');
    });

    it('handles ISO strings at day boundaries', () => {
      // This tests the specific bug scenario
      // When parsed, these should give the correct calendar date
      expect(toDateOnly('2024-06-15T00:00:00.000Z')).toBe('2024-06-15');
      expect(toDateOnly('2024-06-15T23:59:59.999Z')).toBe('2024-06-15');
    });
  });

  describe('error handling', () => {
    it('throws on invalid date strings', () => {
      expect(() => toDateOnly('invalid-date')).toThrow('Vigane DATE väärtus');
      expect(() => toDateOnly('not-a-date')).toThrow('Vigane DATE väärtus');
    });

    it('throws on invalid Date objects', () => {
      const invalidDate = new Date('invalid');
      expect(() => toDateOnly(invalidDate)).toThrow('Vigane DATE väärtus');
    });
  });
});
