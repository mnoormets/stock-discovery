import { describe, expect, it } from 'vitest';
import { summarizeOutcomeCohort } from '../../src/lib/model-outcome-results';

describe('model-version outcome cohort summary', () => {
  it('gives each ticker one result after averaging its repeated decisions', () => {
    const summary = summarizeOutcomeCohort([
      { ticker: 'AAA', status: 'measured', returnPercent: 10, benchmarkStatus: 'measured', excessReturnPercent: 5 },
      { ticker: 'AAA', status: 'measured', returnPercent: -10, benchmarkStatus: 'measured', excessReturnPercent: -15 },
      { ticker: 'BBB', status: 'measured', returnPercent: 20, benchmarkStatus: 'measured', excessReturnPercent: 10 },
    ]);

    expect(summary.measuredDecisionCount).toBe(3);
    expect(summary.measuredTickerCount).toBe(2);
    expect(summary.tickerReturns).toEqual([
      { ticker: 'AAA', returnPercent: 0 },
      { ticker: 'BBB', returnPercent: 20 },
    ]);
    expect(summary.tickerExcessReturns).toEqual([
      { ticker: 'AAA', returnPercent: -5 },
      { ticker: 'BBB', returnPercent: 10 },
    ]);
  });

  it('keeps pending, missing, and unavailable decision coverage separate', () => {
    const summary = summarizeOutcomeCohort([
      { ticker: 'AAA', status: 'pending', returnPercent: null },
      { ticker: 'AAA', status: 'missing', returnPercent: null },
      { ticker: 'BBB', status: 'unavailable', returnPercent: null },
      { ticker: 'CCC', status: 'measured', returnPercent: 4, benchmarkStatus: 'pending', excessReturnPercent: null },
    ]);

    expect(summary).toMatchObject({
      decisionCount: 4,
      distinctTickerCount: 3,
      measuredDecisionCount: 1,
      measuredTickerCount: 1,
      pendingCount: 1,
      missingCount: 1,
      unavailableCount: 1,
      benchmarkMeasuredDecisionCount: 0,
      benchmarkMeasuredTickerCount: 0,
    });
  });
});
