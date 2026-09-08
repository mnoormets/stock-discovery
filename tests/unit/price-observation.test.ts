import { describe, expect, it } from 'vitest';
import { newYorkPriceDate, priceObservationRecency } from '../../src/lib/price-observation';

describe('price observation recency', () => {
  it.each([
    ['2026-09-04T20:00:00Z', '2026-09-06T12:00:00Z', 'recent'],
    ['2026-09-04T20:00:00Z', '2026-09-07T12:00:00Z', 'recent'],
    ['2026-09-04T20:00:00Z', '2026-09-08T12:00:00Z', 'recent'],
    ['2026-09-04T20:00:00Z', '2026-09-09T12:00:00Z', 'stale'],
    ['2026-11-25T21:00:00Z', '2026-11-27T12:00:00Z', 'recent'],
    ['2029-08-31T20:00:00Z', '2029-09-04T12:00:00Z', 'stale'],
    ['2026-09-02T20:00:00Z', '2026-09-06T12:00:00Z', 'stale'],
    ['2026-03-06T21:00:00Z', '2026-03-09T13:00:00Z', 'recent'],
    ['2026-08-18T21:10:11Z', '2026-09-06T12:00:00Z', 'stale'],
    ['2026-09-07T12:00:00Z', '2026-09-06T12:00:00Z', 'unknown'],
    ['invalid', '2026-09-06T12:00:00Z', 'unknown'],
    [null, '2026-09-06T12:00:00Z', 'unknown'],
    ['2026-09-04T20:00:00Z', 'invalid', 'unknown'],
  ] as const)('classifies %s as of %s as %s', (observed, asOf, expected) => {
    expect(priceObservationRecency(observed, asOf)).toBe(expected);
  });

  it('uses the New York date across UTC midnight and rejects invalid timestamps', () => {
    expect(newYorkPriceDate('2026-09-05T01:00:00Z')).toBe('2026-09-04');
    expect(newYorkPriceDate('invalid')).toBeNull();
  });
});
