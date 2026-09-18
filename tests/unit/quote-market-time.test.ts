import { describe, expect, it } from 'vitest';
import { quoteMarketTime } from '../../src/lib/yahoo';

describe('Yahoo quote market timestamp', () => {
  it('preserves Date, ISO and Unix-second representations', () => {
    const iso = '2026-09-17T20:00:00.000Z';
    expect(quoteMarketTime(new Date(iso))).toBe(iso);
    expect(quoteMarketTime(iso)).toBe(iso);
    expect(quoteMarketTime(Date.parse(iso) / 1000)).toBe(iso);
  });
  it('leaves missing and invalid timestamps unknown', () => {
    for (const value of [null, undefined, '', 'invalid', NaN, Infinity, new Date('invalid'), {}]) {
      expect(quoteMarketTime(value)).toBeNull();
    }
  });
});
