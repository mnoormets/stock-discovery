import { describe, expect, it } from 'vitest';
import { toDateOnly } from '../../src/lib/date-only';
import { classifyPriorCoverage } from '../../src/lib/missed-moves';
import { selectFundamentalLookupTickers } from '../../src/lib/collect';
import type { ApeWisdomRow } from '../../src/lib/types';

describe('DATE and missed-move audit boundaries', () => {
  it('normaliseerib pg DATE objekti YYYY-MM-DD kujule', () => {
    expect(toDateOnly(new Date('2026-08-15T00:00:00.000Z'))).toBe('2026-08-15');
    expect(toDateOnly('2026-08-15')).toBe('2026-08-15');
  });

  it('eristab canonical otsuse, radari andmelünga ja universumi lünga', () => {
    expect(classifyPriorCoverage({ hadDecision: true, decisionIncluded: true, radarSeenBeforeMove: true })).toBe('included');
    expect(classifyPriorCoverage({ hadDecision: true, decisionIncluded: false, radarSeenBeforeMove: true })).toBe('excluded');
    expect(classifyPriorCoverage({ hadDecision: false, decisionIncluded: null, radarSeenBeforeMove: true })).toBe('radar_data_gap');
    expect(classifyPriorCoverage({ hadDecision: false, decisionIncluded: null, radarSeenBeforeMove: false })).toBe('universe_gap');
  });

  it('annab langeva, kuid endiselt tähelepanu saava tickeri recall-ringile', () => {
    const rows: ApeWisdomRow[] = Array.from({ length: 40 }, (_, index) => ({
      rank: index + 1, ticker: `G${index}`, name: `Growth ${index}`,
      mentions: 10 + index, upvotes: 0, rank_24h_ago: null, mentions_24h_ago: 1,
    }));
    rows.push({
      rank: 56, ticker: 'RDDT', name: 'Reddit', mentions: 13, upvotes: 0,
      rank_24h_ago: 40, mentions_24h_ago: 20,
    });
    const selected = selectFundamentalLookupTickers(rows);
    expect(selected.growthTickers).not.toContain('RDDT');
    expect(selected.recallTickers).toContain('RDDT');
    expect(selected.lookupTickers).toHaveLength(41);
  });
});
