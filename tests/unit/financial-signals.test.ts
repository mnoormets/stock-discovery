import { describe, expect, it } from 'vitest';
import { financialSignals } from '../../src/lib/signals/financial-signals';
import type { BriefSource } from '../../src/lib/signals/types';

function financial(metric: 'cash' | 'debt', value: number, periodEnd: string): BriefSource {
  return {
    id: `financial:${metric}`, type: 'financial', label: metric, url: 'https://www.sec.gov/test', occurredAt: '2026-08-10T00:00:00.000Z',
    data: { metric, role: 'latest', value, unit: 'USD', periodEnd },
  };
}

describe('financial signals', () => {
  it('does not infer a cash/debt conclusion from different balance-sheet dates', () => {
    const result = financialSignals({ ticker: 'BW', companyName: 'BW', sources: [
      financial('cash', 308_634_000, '2026-06-30'), financial('debt', 182_000_000, '2021-12-31'),
    ] });
    expect(result.catalysts).toEqual([]);
    expect(result.risks).toEqual([]);
  });

  it('keeps the cash/debt inference when both values share a balance-sheet date', () => {
    const result = financialSignals({ ticker: 'TEST', companyName: 'Test', sources: [
      financial('cash', 200, '2026-06-30'), financial('debt', 100, '2026-06-30'),
    ] });
    expect(result.catalysts?.map((item) => item.text)).toContain('Raha ja ekvivalendid katavad SEC-is raporteeritud võla.');
  });
});
