import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewedBalanceSheet from '../../src/components/ReviewedBalanceSheet';
import { getReviewedBalanceSheet, reconciliationTotals } from '../../src/lib/reviewed-balance-sheets';

describe('reviewed SEC balance sheets', () => {
  it('reconciles all four BW borrowing lines without treating preferred equity or leases as included', () => {
    const review = getReviewedBalanceSheet('BW')!;
    expect(reconciliationTotals(review)).toEqual({ borrowings: 276_843_000, liquidity: 308_634_000, difference: 31_791_000 });
    expect(review.otherLines.find((line) => line.label.startsWith('Preferred stock'))?.usd).toBe(191_700_000);
    expect(review.otherLines.find((line) => line.label.startsWith('Finance leases'))?.usd).toBe(27_822_000);
  });
  it('reconciles API liquidity without adding restricted cash or unrelated investments', () => {
    const review = getReviewedBalanceSheet('api')!;
    expect(reconciliationTotals(review)).toEqual({ borrowings: 100_316_000, liquidity: 361_655_000, difference: 261_339_000 });
    expect(review.shares).toContain('1 ADS = 4');
    expect(review.shares).toContain('92,384,656');
  });
  it('shows dates, source, manual status and limitations rather than implying live inputs', () => {
    const html = renderToStaticMarkup(createElement(ReviewedBalanceSheet, { ticker: 'API' }));
    expect(html).toContain('2026-06-30');
    expect(html).toContain('does not update automatically');
    expect(html).toContain('api-ex99_1.htm');
    expect(html).toContain('not distributable cash');
    expect(renderToStaticMarkup(createElement(ReviewedBalanceSheet, { ticker: 'HIMS' }))).toBe('');
  });
});
