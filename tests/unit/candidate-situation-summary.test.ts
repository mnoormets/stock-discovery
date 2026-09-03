import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CandidateSituationSummary from '../../src/components/CandidateSituationSummary';
import type { CandidatePriceContext } from '../../src/lib/price-context';

function priceContext(overrides: Partial<CandidatePriceContext> = {}): CandidatePriceContext {
  return {
    version: 'price-context-v1',
    asOf: '2026-09-03T12:00:00.000Z',
    currentPrice: 100,
    oneMonthReturnPercent: 5,
    threeMonthReturnPercent: 10,
    sixMonthReturnPercent: 15,
    distanceFrom52WeekHighPercent: -10,
    distanceFrom52WeekLowPercent: 20,
    fiftyTwoWeekHigh: 111,
    fiftyTwoWeekLow: 83,
    historyStatus: 'sufficient',
    observationCount: 20,
    oldestObservationAt: '2025-09-03T12:00:00.000Z',
    newestObservationAt: '2026-09-03T12:00:00.000Z',
    recentRunUp: false,
    recentRunUpReasons: [],
    ...overrides,
  };
}

function render(overrides: Partial<Parameters<typeof CandidateSituationSummary>[0]> = {}): string {
  return renderToStaticMarkup(createElement(CandidateSituationSummary, {
    growthScore: 80,
    healthScore: 75,
    coverageScore: 90,
    priceContext: priceContext(),
    ...overrides,
  }));
}

describe('CandidateSituationSummary', () => {
  it('shows strong business and a separate not-overheated market state', () => {
    const html = render();
    expect(html).toContain('Business');
    expect(html).toContain('Strong');
    expect(html).toContain('Market setup');
    expect(html).toContain('Not overheated');
    expect(html).toContain('Growth 80/100 · Health 75/100 · Coverage 90/100');
    expect(html).toContain('not a buy signal');
  });

  it('does not treat an elevated run-up as positive market evidence', () => {
    const html = render({ priceContext: priceContext({
      recentRunUp: true,
      recentRunUpReasons: ['1-month return is +24.0%'],
    }) });
    expect(html).toContain('Run-up elevated');
    expect(html).toContain('1-month return is +24.0%');
  });

  it('keeps missing business inputs visible and insufficient market history unknown', () => {
    const html = render({
      growthScore: null,
      priceContext: priceContext({ historyStatus: 'insufficient' }),
    });
    expect(html).toContain('Mixed');
    expect(html).toContain('Growth unknown');
    expect(html).toContain('Market setup');
    expect(html).toContain('Unknown');
    expect(html).toContain('the setup is not inferred');
  });
});
