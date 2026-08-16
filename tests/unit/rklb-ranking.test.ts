import { describe, expect, it } from 'vitest';
import {
  compareRklbRankFactors,
  explainAdjacentRklbRanks,
  type RklbRankFactors,
} from '../../src/lib/rklb-ranking';

function factors(overrides: Partial<RklbRankFactors> & Pick<RklbRankFactors, 'ticker'>): RklbRankFactors {
  return {
    supportedCriteriaCount: 5,
    catalystTier: 3,
    growthScore: 80,
    coverageScore: 90,
    healthScore: 70,
    ...overrides,
  };
}

describe('RKLB ranking comparator explanation', () => {
  it('uses supported criteria before every later field', () => {
    const higher = factors({ ticker: 'FIRST', supportedCriteriaCount: 5, catalystTier: 0, growthScore: 65, coverageScore: 70, healthScore: 10 });
    const lower = factors({ ticker: 'SECOND', supportedCriteriaCount: 4, catalystTier: 4, growthScore: 100, coverageScore: 100, healthScore: 100 });

    expect(compareRklbRankFactors(higher, lower)).toBeLessThan(0);
    expect(explainAdjacentRklbRanks(higher, lower)).toMatchObject({
      decisiveFactor: 'supported_criteria',
      consistentWithComparator: true,
    });
  });

  it.each([
    ['catalyst_tier', { catalystTier: 3 }, { catalystTier: 2 }],
    ['growth', { growthScore: 81 }, { growthScore: 80 }],
    ['coverage', { coverageScore: 91 }, { coverageScore: 90 }],
    ['health', { healthScore: 71 }, { healthScore: 70 }],
  ] as const)('uses %s as the first decisive field after earlier ties', (decisiveFactor, higherDelta, lowerDelta) => {
    const higher = factors({ ticker: 'HIGHER', ...higherDelta });
    const lower = factors({ ticker: 'LOWER', ...lowerDelta });
    const explanation = explainAdjacentRklbRanks(higher, lower);

    expect(compareRklbRankFactors(higher, lower)).toBeLessThan(0);
    expect(explanation.decisiveFactor).toBe(decisiveFactor);
    expect(explanation.factors.slice(0, explanation.factors.findIndex((factor) => factor.key === decisiveFactor)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ tied: true })]));
  });

  it('uses the same -1 missing-value semantics as the discovery comparator', () => {
    const known = factors({ ticker: 'KNOWN', growthScore: 0 });
    const missing = factors({ ticker: 'MISSING', growthScore: null });

    expect(compareRklbRankFactors(known, missing)).toBeLessThan(0);
    expect(explainAdjacentRklbRanks(known, missing)).toMatchObject({
      decisiveFactor: 'growth',
      consistentWithComparator: true,
    });
  });

  it('states a research-factor tie explicitly and does not call ticker a research advantage', () => {
    const alpha = factors({ ticker: 'ALPHA' });
    const beta = factors({ ticker: 'BETA' });
    const explanation = explainAdjacentRklbRanks(alpha, beta);

    expect(compareRklbRankFactors(alpha, beta)).toBeLessThan(0);
    expect(explanation).toMatchObject({ decisiveFactor: null, researchFactorsTied: true });
    expect(explanation.summary).toMatch(/all five research ranking factors tie/i);
    expect(explanation.summary).toMatch(/not a research advantage/i);
  });

  it('flags a stored adjacent order that conflicts with the shown comparator fields', () => {
    const storedHigher = factors({ ticker: 'LOWER_INPUT', coverageScore: 80 });
    const storedLower = factors({ ticker: 'HIGHER_INPUT', coverageScore: 90 });
    const explanation = explainAdjacentRklbRanks(storedHigher, storedLower);

    expect(explanation.consistentWithComparator).toBe(false);
    expect(explanation.summary).toMatch(/does not match/i);
  });
});
