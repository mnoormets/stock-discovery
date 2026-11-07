import { describe, expect, it } from 'vitest';
import {
  isExpectedNewYorkRegularSession,
  newYorkPriceDate,
  priceObservationRecency,
} from '../../src/lib/price-observation';

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

  it.each([
    ['2026-09-14T13:35:00Z', true],
    ['2026-09-13T13:35:00Z', false],
    ['2026-09-07T13:35:00Z', false],
    ['2026-09-14T13:29:00Z', false],
    ['2026-09-14T20:00:00Z', false],
    ['2026-11-02T14:35:00Z', true],
    ['invalid', false],
  ] as const)('classifies expected NYSE session at %s as %s', (timestamp, expected) => {
    expect(isExpectedNewYorkRegularSession(timestamp)).toBe(expected);
  });
});


describe('published NYSE early closes',()=>{
  it.each([
    ['2026-11-27',18],['2026-12-24',18],['2027-11-26',18],['2028-07-03',17],['2028-11-24',18],
  ] as const)('ends the session at13:00 NewYork on %s across DST offsets',(day,utcHour)=>{
    const close=Date.parse(day+'T'+utcHour+':00:00Z'),open=close-3.5*3600000;
    expect(isExpectedNewYorkRegularSession(new Date(open-1))).toBe(false);
    expect(isExpectedNewYorkRegularSession(new Date(open))).toBe(true);
    expect(isExpectedNewYorkRegularSession(new Date(close-1))).toBe(true);
    expect(isExpectedNewYorkRegularSession(new Date(close))).toBe(false);
    expect(isExpectedNewYorkRegularSession(new Date(close+3600000))).toBe(false);
  });
  it('retains neighboring full sessions and full-day holidays',()=>{
    for(const timestamp of ['2026-11-25T20:00:00Z','2027-12-23T20:00:00Z','2028-07-05T19:00:00Z'])expect(isExpectedNewYorkRegularSession(timestamp)).toBe(true);
    for(const timestamp of ['2026-11-26T16:00:00Z','2027-12-24T16:00:00Z','2028-07-04T16:00:00Z'])expect(isExpectedNewYorkRegularSession(timestamp)).toBe(false);
  });
});
