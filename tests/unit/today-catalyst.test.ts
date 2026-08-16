import { describe, expect, it } from 'vitest';
import { buildHumanCatalystSummary } from '../../src/lib/today-brief';

describe('Today catalyst human wording', () => {
  it('maps primary_sec, quantified_major and new_information into a short evidence sentence', () => {
    const summary = buildHumanCatalystSummary({
      eventKind: 'sec_filing',
      sourceKind: 'primary_sec',
      materiality: 'quantified_major',
      direction: 'mixed',
      novelty: 'new_information',
      thesisRelevance: 'decisive',
    });

    expect(summary.headline).toBe('The SEC filing from the SEC primary source added new information.');
    expect(summary.assessment).toBe('The stored rule assessment calls it a major quantified signal, with mixed business evidence, and directly relevant to the thesis question.');
  });

  it('does not turn a scheduled secondary event into confirmed evidence', () => {
    const summary = buildHumanCatalystSummary({
      eventKind: 'earnings_scheduled',
      sourceKind: 'secondary_news',
      materiality: 'unknown',
      direction: 'unknown',
      novelty: 'unknown',
      thesisRelevance: 'unknown',
    });

    expect(summary.headline).toMatch(/scheduled earnings event.*secondary news source.*unknown novelty/i);
    expect(summary.assessment).toMatch(/unknown in materiality.*unknown business direction.*unknown thesis relevance/i);
  });

  it('uses an explicit unavailable sentence instead of inventing an event', () => {
    const summary = buildHumanCatalystSummary({
      eventKind: null,
      sourceKind: null,
      materiality: 'unknown',
      direction: null,
      novelty: null,
      thesisRelevance: null,
    });

    expect(summary.headline).toBe('No specific catalyst event is captured in this brief.');
    expect(summary.sourceLabel).toBe('source not captured');
  });
});
