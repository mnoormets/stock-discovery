import { describe, expect, it } from 'vitest';
import { calculateValuationEvidence, type ValuationInputMetric } from '../../src/lib/valuation-evidence';

const metric = (periodEnd: string | null): ValuationInputMetric => ({
  value: 100, periodEnd, periodKind: 'instant', accessionNumber: 'filing', sourceUrl: null,
});

describe('EV/Sales balance-sheet evidence', () => {
  it.each([
    ['2026-06-30', '2021-09-30'],
    ['2026-06-30', '2026-03-31'],
    ['2021-09-30', '2021-09-30'],
    ['2027-06-30', '2027-06-30'],
    [null, null],
  ])('withholds the multiple for cash %s and debt %s', (cashDate, debtDate) => {
    const result = calculateValuationEvidence({ marketCap: 1000,
      cash: metric(cashDate), debt: metric(debtDate),
      revenue: { ...metric('2026-06-30'), periodKind: 'quarter' },
      netIncome: null, freeCashFlow: null,
    }, new Date('2026-09-07T00:00:00Z'));
    expect(result.anchors.find((anchor) => anchor.kind === 'ev_sales')).toMatchObject({
      status: 'insufficient_data', value: null,
    });
  });
});
