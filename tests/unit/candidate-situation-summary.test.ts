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
    ticker: 'TEST',
    growthScore: 80,
    healthScore: 75,
    coverageScore: 90,
    currentCollectionConfirmed: true,
    priceCapturedAt: '2026-09-03T12:00:00.000Z',
    priceContext: priceContext(),
    ...overrides,
  }));
}

describe('CandidateSituationSummary', () => {
  it('does not give BW or ELF a green setup from an old decision price', () => {
    for (const capturedAt of ['2026-08-18T21:10:11.863Z', '2026-08-26T05:11:26.150Z']) {
      const html = render({
        priceCapturedAt: capturedAt,
        priceContext: priceContext({ asOf: '2026-09-06T05:28:45.025Z', historyStatus: 'partial' }),
      });
      expect(html).toContain('Current setup unknown');
      expect(html).toContain('Stored price is stale');
      expect(html).toContain('Wait');
      expect(html).toContain('requires a recent, valid displayed decision price');
      expect(html).not.toContain('Not overheated');
    }
  });

  it('identifies partial windows without an unqualified positive setup', () => {
    const html = render({ priceContext: priceContext({
      historyStatus: 'partial', threeMonthReturnPercent: null, sixMonthReturnPercent: null,
    }) });
    expect(html).toContain('Partial history');
    expect(html).toContain('Assessed windows: 1 month');
    expect(html).not.toContain('Not overheated');
  });

  it('makes the positive paper-entry state explicit when every entry-aware gate passes', () => {
    const html = render();
    expect(html).toContain('Business');
    expect(html).toContain('Strong');
    expect(html).toContain('Market setup');
    expect(html).toContain('Not overheated');
    expect(html).toContain('Growth 80/100 · Health 75/100 · Coverage 90/100');
    expect(html).toContain('Paper entry test');
    expect(html).toContain('Eligible for paper entry');
    expect(html).toContain('hypothetical $100 buy intent');
    expect(html).toContain('clearest positive state');
  });

  it('labels a research candidate as wait when current collection data is not confirmed', () => {
    const html = render({ currentCollectionConfirmed: false });
    expect(html).toContain('Paper entry test');
    expect(html).toContain('Wait');
    expect(html).toContain('Research candidate only');
    expect(html).toContain('did not confirm current market data');
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
