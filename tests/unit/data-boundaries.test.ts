import { describe, expect, it } from 'vitest';
import { toDateOnly } from '../../src/lib/date-only';
import { classifyPriorCoverage } from '../../src/lib/missed-moves';
import { mergeFundamentalLookupTickers, selectFundamentalLookupTickers } from '../../src/lib/collect';
import { buildCandidates } from '../../src/lib/discovery';
import type { ApeWisdomRow, Fundamentals } from '../../src/lib/types';

describe('DATE and missed-move audit boundaries', () => {
  it('normaliseerib pg DATE objekti YYYY-MM-DD kujule', () => {
    // pg-types parsib DATE (typeId 1082) LOKAALSEKS kesköökes, seega
    // `new Date(y, m-1, d)` on täpselt see kuju, mille pg klient tagastab.
    expect(toDateOnly(new Date(2026, 7, 15))).toBe('2026-08-15');
    expect(toDateOnly('2026-08-15')).toBe('2026-08-15');
  });

  it('eristab canonical otsuse, radari andmelünga ja universumi lünga', () => {
    expect(classifyPriorCoverage({ hadDecision: true, decisionIncluded: true, radarSeenBeforeMove: true })).toBe('included');
    expect(classifyPriorCoverage({ hadDecision: true, decisionIncluded: false, radarSeenBeforeMove: true })).toBe('excluded');
    expect(classifyPriorCoverage({ hadDecision: false, decisionIncluded: null, radarSeenBeforeMove: true })).toBe('radar_data_gap');
    expect(classifyPriorCoverage({ hadDecision: false, decisionIncluded: null, radarSeenBeforeMove: false })).toBe('universe_gap');
  });

  it('annab langeva, kuid endiselt tähelepanu saava tickeri recall-ringile', () => {
    const rows: ApeWisdomRow[] = Array.from({ length: 80 }, (_, index) => ({
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
    expect(selected.lookupTickers).toHaveLength(81);
  });

  it('piirab fundamentaalpäringud 80 kasvu- ja 20 recall-tickeriga', () => {
    const rows: ApeWisdomRow[] = Array.from({ length: 120 }, (_, index) => ({
      rank: index + 1, ticker: `T${index}`, name: `Ticker ${index}`,
      mentions: 10 + index, upvotes: 0, rank_24h_ago: null, mentions_24h_ago: 1,
    }));

    const selected = selectFundamentalLookupTickers(rows);
    expect(selected.growthTickers).toHaveLength(80);
    expect(selected.recallTickers).toHaveLength(20);
    expect(selected.lookupTickers).toHaveLength(100);
    expect(new Set(selected.lookupTickers)).toHaveLength(100);
  });

  it('lisab insider lookupid unikaalse unionina social lookupide järele', () => {
    expect(mergeFundamentalLookupTickers(['GROW', 'BOTH'], ['BOTH', 'FORM']))
      .toEqual(['GROW', 'BOTH', 'FORM']);
  });

  it('ei lase insider-only fundamentaale buildCandidates social-skoorimisse', () => {
    const fundamentals = new Map<string, Fundamentals>([['MRNA', {
      ticker: 'MRNA', name: 'Moderna, Inc.', marketCap: 65_000_000_000,
      price: 170, currency: 'USD', volume: 1_000_000, source: 'yahoo',
    }]]);
    expect(buildCandidates([], new Map(), fundamentals, new Map(), new Set())).toEqual([]);
  });
});

// F1 (investigation/postgresql-date-timezone-audit.md).
//
// pg-types parsib DATE (typeId 1082) LOKAALSEKS kesköökes, mitte UTC
// kesköökes. Varem luges `toDateOnly` Date objektilt kuupäeva
// `toISOString()`-iga, mis nihutas selle päeva võrra tagasi igas positiivse
// UTC-nihkega ajavööndis. Mõõdetud golden-source andmetega Europe/Tallinnas:
// canonical run #34 (DB 2026-08-19) andis 2026-08-18, #32 (2026-08-17) andis
// 2026-08-16 ja #31 (2026-08-16) andis 2026-08-15.
//
// `pgDate()` konstrueerib täpselt sama kuju, mille pg klient tagastab. Kuna
// konstrueerimine ja lugemine kasutavad sama lokaalset raami, on need
// assertsioonid ajavööndist sõltumatud ega vaja process.env.TZ muutmist.
// (Windowsil ignoreeriks Node niikuinii IANA TZ väärtusi peale UTC, seega
// TZ-i muutev test läbiks vale põhjusel.)
function pgDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe('toDateOnly F1: pg DATE ei nihku päeva võrra', () => {
  it.each([
    ['2026-08-19', pgDate(2026, 8, 19)],
    ['2026-08-17', pgDate(2026, 8, 17)],
    ['2026-08-16', pgDate(2026, 8, 16)],
  ])('golden-source canonical kuupäev %s jääb muutumatuks', (expected, value) => {
    expect(toDateOnly(value)).toBe(expected);
  });

  it('katab kuu- ja aastapiiri, kus nihe oleks kõige nähtavam', () => {
    expect(toDateOnly(pgDate(2026, 1, 1))).toBe('2026-01-01');
    expect(toDateOnly(pgDate(2026, 3, 1))).toBe('2026-03-01');
    expect(toDateOnly(pgDate(2026, 12, 31))).toBe('2026-12-31');
  });

  it('DATE string läheb regex-teed ilma ajavööndi teisendust', () => {
    expect(toDateOnly('2026-08-17')).toBe('2026-08-17');
    expect(toDateOnly('2026-08-19T21:30:00.000Z')).toBe('2026-08-19');
  });

  // Instant-kujuline sisend (nt TIMESTAMPTZ). Kalendripäev on siin olemuslikult
  // ajavööndi-relatiivne; UTC keskpäev jääb samasse kalendripäeva igas tsoonis,
  // mille nihe on kuni ±12 h, mis katab kõik selle rakenduse käivituskeskkonnad
  // (Europe/Tallinn kodus ja Dockeris, UTC CI-s).
  it('instant teisendub oma lokaalseks kalendripäevaks', () => {
    expect(toDateOnly(new Date('2026-08-17T12:00:00.000Z'))).toBe('2026-08-17');
  });

  it('säilitab senise vea-käitumise tühja ja vigase sisendi korral', () => {
    expect(() => toDateOnly(null)).toThrow('Vigane DATE väärtus: (tühi)');
    expect(() => toDateOnly(undefined)).toThrow('Vigane DATE väärtus: (tühi)');
    expect(() => toDateOnly('')).toThrow('Vigane DATE väärtus: (tühi)');
    expect(() => toDateOnly('   ')).toThrow('Vigane DATE väärtus: (tühi)');
    expect(() => toDateOnly(new Date('x'))).toThrow('Vigane DATE väärtus.');
  });
});
