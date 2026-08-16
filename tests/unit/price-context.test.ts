import { describe, expect, it } from 'vitest';
import { buildPriceContext } from '../../src/lib/price-context';

describe('Price Context V1', () => {
  it('arvutab salvestatud ajaloost 1m/3m/6m tootlused ja 52n vahemiku', () => {
    const context = buildPriceContext({
      asOf: '2026-08-16T08:00:00.000Z',
      currentPrice: 100,
      observations: [
        { price: 40, capturedAt: '2025-08-16T08:00:00.000Z' },
        { price: 120, capturedAt: '2026-01-15T08:00:00.000Z' },
        { price: 50, capturedAt: '2026-02-17T08:00:00.000Z' },
        { price: 70, capturedAt: '2026-05-18T08:00:00.000Z' },
        { price: 80, capturedAt: '2026-07-17T08:00:00.000Z' },
      ],
    });

    expect(context).toMatchObject({
      historyStatus: 'sufficient',
      oneMonthReturnPercent: 25,
      threeMonthReturnPercent: 42.86,
      sixMonthReturnPercent: 100,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 40,
      distanceFrom52WeekHighPercent: -16.67,
      distanceFrom52WeekLowPercent: 150,
      recentRunUp: true,
    });
    expect(context.recentRunUpReasons).toHaveLength(3);
  });

  it('ei leiuta puuduva ajaloo korral tootlusi ega run-up warningut', () => {
    const context = buildPriceContext({
      asOf: '2026-08-16T08:00:00.000Z',
      currentPrice: 91.44,
      observations: [
        { price: 92.05, capturedAt: '2026-08-13T08:00:00.000Z' },
        { price: 91.44, capturedAt: '2026-08-15T08:00:00.000Z' },
      ],
    });

    expect(context.historyStatus).toBe('insufficient');
    expect(context.oneMonthReturnPercent).toBeNull();
    expect(context.threeMonthReturnPercent).toBeNull();
    expect(context.sixMonthReturnPercent).toBeNull();
    expect(context.distanceFrom52WeekHighPercent).toBeNull();
    expect(context.distanceFrom52WeekLowPercent).toBeNull();
    expect(context.recentRunUp).toBe(false);
  });

  it('kasutab run-up warninguks läbipaistvat 20% ühe kuu läve', () => {
    const below = buildPriceContext({
      asOf: '2026-08-16T08:00:00.000Z',
      currentPrice: 119.99,
      observations: [{ price: 100, capturedAt: '2026-07-17T08:00:00.000Z' }],
    });
    const atThreshold = buildPriceContext({
      asOf: '2026-08-16T08:00:00.000Z',
      currentPrice: 120,
      observations: [{ price: 100, capturedAt: '2026-07-17T08:00:00.000Z' }],
    });

    expect(below.recentRunUp).toBe(false);
    expect(atThreshold.recentRunUp).toBe(true);
  });
});
