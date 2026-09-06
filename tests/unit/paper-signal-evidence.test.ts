import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PaperSignalEvidence from '../../src/components/PaperSignalEvidence';
import { getPaperBookStatus, parsePaperSignalEvidence } from '../../src/lib/paper-performance';

const captured = {
  version: 'paper-strategy-signal-v1',
  businessState: 'strong',
  marketSetupState: 'not_overheated',
  freshnessState: 'current_collection_confirmed',
  reasons: ['Business and market gates passed.'],
};

describe('paper signal evidence read model', () => {
  it('preserves the two independent signal states and reasons', () => {
    expect(parsePaperSignalEvidence(captured)).toEqual({
      state: 'captured',
      version: 'paper-strategy-signal-v1',
      businessState: 'strong',
      marketSetupState: 'not_overheated',
      freshnessState: 'current_collection_confirmed',
      reasons: ['Business and market gates passed.'],
    });
  });

  it.each([
    null,
    {},
    { ...captured, version: 'paper-strategy-exit-v1' },
    { ...captured, businessState: 'great' },
    { ...captured, reasons: [0] },
  ])('fails closed for legacy or malformed snapshots', (input) => {
    expect(parsePaperSignalEvidence(input)).toEqual({
      state: 'unknown', version: null, businessState: 'unknown',
      marketSetupState: 'unknown', freshnessState: 'unknown', reasons: [],
    });
  });
});

describe('PaperSignalEvidence', () => {
  it('renders business and market setup side by side with the frozen reason', () => {
    const html = renderToStaticMarkup(createElement(PaperSignalEvidence, {
      evidence: parsePaperSignalEvidence(captured),
    }));
    expect(html).toContain('Business');
    expect(html).toContain('Strong');
    expect(html).toContain('Market setup');
    expect(html).toContain('Not overheated');
    expect(html).toContain('Current collection confirmed');
    expect(html).toContain('Business and market gates passed.');
  });

  it('shows honest unknown states without inventing a recommendation', () => {
    const html = renderToStaticMarkup(createElement(PaperSignalEvidence, {
      evidence: parsePaperSignalEvidence(null),
    }));
    expect((html.match(/Unknown/g) ?? [])).toHaveLength(2);
    expect(html).toContain('evidence is unavailable');
    expect(html.toLowerCase()).not.toContain('buy');
  });
});

describe('paper book status', () => {
  it('does not call a skipped-only book valued when it has no filled position', () => {
    expect(getPaperBookStatus({ filledOrders: 0, pendingOrders: 0, valuationComplete: true }))
      .toBe('no_positions');
  });

  it('distinguishes pending orders, complete marks, and missing marks', () => {
    expect(getPaperBookStatus({ filledOrders: 0, pendingOrders: 2, valuationComplete: true })).toBe('pending');
    expect(getPaperBookStatus({ filledOrders: 1, pendingOrders: 0, valuationComplete: true })).toBe('valued');
    expect(getPaperBookStatus({ filledOrders: 1, pendingOrders: 0, valuationComplete: false })).toBe('valuation_incomplete');
  });
});
