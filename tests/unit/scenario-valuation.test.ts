import { describe, expect, it } from 'vitest';
import { buildScenarioValuation } from '../../src/lib/scenario-valuation';
import type { ValuationEvidenceInput, ValuationInputMetric } from '../../src/lib/valuation-evidence';

function metric(value: number, periodKind: ValuationInputMetric['periodKind'] = 'annual'): ValuationInputMetric {
  return {
    value,
    periodEnd: '2025-12-31',
    periodKind,
    accessionNumber: 'test-accession',
    sourceUrl: 'https://www.sec.gov/test',
  };
}

function input(overrides: Partial<ValuationEvidenceInput> = {}): ValuationEvidenceInput {
  return {
    marketCap: 1_000_000_000,
    revenue: null,
    netIncome: null,
    freeCashFlow: null,
    cash: null,
    debt: null,
    ...overrides,
  };
}

describe('Scenario Valuation V1', () => {
  it('ehitab positiivse net income korral läbipaistva P/E sensitivity', () => {
    const valuation = buildScenarioValuation(
      input({ netIncome: metric(40_000_000) }),
      100,
      new Date('2026-08-16T08:00:00.000Z'),
    );

    expect(valuation).toMatchObject({
      status: 'available',
      anchorKind: 'pe',
      anchorValue: 25,
      scenarios: [
        { case: 'bear', impliedPrice: 64, upsideDownsidePercent: -36 },
        { case: 'base', impliedPrice: 100, upsideDownsidePercent: 0 },
        { case: 'bull', impliedPrice: 144, upsideDownsidePercent: 44 },
      ],
    });
  });

  it('kasutab P/E puudumisel olemasolevat EV/Sales ankrut', () => {
    const valuation = buildScenarioValuation(
      input({
        revenue: metric(250_000_000, 'quarter'),
        cash: metric(100_000_000, 'instant'),
        debt: metric(200_000_000, 'instant'),
      }),
      100,
      new Date('2026-08-16T08:00:00.000Z'),
    );

    expect(valuation.status).toBe('available');
    expect(valuation.anchorKind).toBe('ev_sales');
    expect(valuation.scenarios.map((scenario) => scenario.impliedPrice)).toEqual([60.4, 100, 148.4]);
  });

  it('tagastab puuduva fundamentaali korral unavailable, mitte oletuse', () => {
    const valuation = buildScenarioValuation(input(), 100);

    expect(valuation.status).toBe('unavailable');
    expect(valuation.scenarios).toEqual([]);
    expect(valuation.reason).toMatch(/No positive P \/ E, EV \/ Sales, or FCF yield/i);
  });
});
