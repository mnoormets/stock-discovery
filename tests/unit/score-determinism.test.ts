import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateCompanyScores,
  type CompanyScore,
  type CompanyScores,
} from '../../src/lib/company-scores';
import {
  fullyCoveredFinancials,
  makeFinancials,
  resetFixtureIds,
} from '../fixtures/financials';

// B-blokk: score determinism. Testitav loogika on DB-vaba — `company-scores.ts`
// impordib ainult tüüpe (rida 1). Ainus andmebaasipuude tuleb tests/setup/guard.ts
// isolatsioonikontrollist, mis jookseb setupFiles'ina iga testifaili ees ja teeb
// ainult ühe lugemispäringu. Ükski selle faili test ei kirjuta andmebaasi.
//
// Kõik oodatud väärtused on tuletatud src/lib/company-scores.ts loogikast:
//   growthRateScore     read 85-93
//   cashDebtComponent   read 124-137
//   finalize            read 95-107
//   null-haru           read 168-179

beforeEach(() => {
  resetFixtureIds();
});

function allComponents(scores: CompanyScores): CompanyScore['components'] {
  return [
    ...(scores.growth?.components ?? []),
    ...(scores.financialHealth?.components ?? []),
    ...scores.coverage.components,
  ];
}

describe('B1 — sama sisend annab identse väljundi', () => {
  it('kaks kutset sama objektiga annavad deep-equal tulemuse', () => {
    const financials = fullyCoveredFinancials();
    const first = calculateCompanyScores(financials);
    const second = calculateCompanyScores(financials);
    expect(second).toEqual(first);
  });

  it('kaks eraldi ehitatud identset sisendit annavad sama skoori', () => {
    // Fact ID-d erinevad (fixture loendur jookseb edasi), aga skoor ei tohi
    // fact ID-dest sõltuda — ainult väärtustest ja YoY-st.
    const a = calculateCompanyScores(fullyCoveredFinancials());
    const b = calculateCompanyScores(fullyCoveredFinancials());
    expect(b).toEqual(a);
  });
});

describe('B2 — mõõdikute järjekord ei muuda skoori', () => {
  it('pöördjärjestuses lisatud mõõdikud annavad identse tulemuse', () => {
    const forward = makeFinancials({
      revenue: { value: 1_000, yoy: 12 },
      net_income: { value: 100, yoy: 5 },
      operating_cash_flow: { value: 200, yoy: 8 },
      free_cash_flow: { value: 150, yoy: 3 },
      cash: { value: 500 },
      debt: { value: 250 },
      shares_outstanding: { value: 1_000_000, yoy: 1 },
    });
    resetFixtureIds();
    const reversed = makeFinancials({
      shares_outstanding: { value: 1_000_000, yoy: 1 },
      debt: { value: 250 },
      cash: { value: 500 },
      free_cash_flow: { value: 150, yoy: 3 },
      operating_cash_flow: { value: 200, yoy: 8 },
      net_income: { value: 100, yoy: 5 },
      revenue: { value: 1_000, yoy: 12 },
    });

    // Kinnitus, et fixture päriselt erineb võtmete järjekorra poolest.
    expect(Object.keys(forward.metrics)).not.toEqual(Object.keys(reversed.metrics));

    const a = calculateCompanyScores(forward);
    const b = calculateCompanyScores(reversed);
    expect(b.growth?.score).toBe(a.growth?.score);
    expect(b.financialHealth?.score).toBe(a.financialHealth?.score);
    expect(b.coverage.score).toBe(a.coverage.score);
  });
});

describe('B3 — puuduv mõõdik langetab Coverage\'i, mitte skoori', () => {
  it('shares_outstanding puudumine ei nulli Health skoori ega viska erindit', () => {
    const full = calculateCompanyScores(fullyCoveredFinancials());
    resetFixtureIds();
    const withoutShares = calculateCompanyScores(makeFinancials({
      revenue: { value: 1_000, yoy: 0 },
      net_income: { value: 100, yoy: 0 },
      operating_cash_flow: { value: 200, yoy: 0 },
      free_cash_flow: { value: 150, yoy: 0 },
      cash: { value: 500 },
      debt: { value: 250 },
    }));

    // Skoor EI lange: puuduvad andmed ei muutu automaatselt nullpunktideks.
    expect(withoutShares.financialHealth).not.toBeNull();
    expect(withoutShares.financialHealth?.score).toBe(full.financialHealth?.score);

    // Kate langeb ja kajastab lünka ausalt.
    expect(full.financialHealth?.coveragePercent).toBe(100);
    expect(withoutShares.financialHealth?.coveragePercent).toBe(85);
    expect(withoutShares.coverage.score).toBeLessThan(full.coverage.score);
    expect(withoutShares.coverage.components[1].detail).toBe('4/5 komponenti');
  });

  it('ainult revenue: Health on null, Growth kate on 50%', () => {
    const scores = calculateCompanyScores(makeFinancials({
      revenue: { value: 1_000, yoy: 10 },
    }));
    expect(scores.growth).not.toBeNull();
    expect(scores.growth?.coveragePercent).toBe(50);
    expect(scores.financialHealth).toBeNull();
    expect(scores.coverage.components[0].detail).toBe('1/4 komponenti');
    expect(scores.coverage.components[1].detail).toBe('0/5 komponenti');
  });
});

describe('B4 — null sisend annab dokumenteeritud kuju, mitte erindi', () => {
  it('growth ja financialHealth on null, coverage on 0', () => {
    const scores = calculateCompanyScores(null);
    expect(scores.growth).toBeNull();
    expect(scores.financialHealth).toBeNull();
    expect(scores.coverage.kind).toBe('coverage');
    expect(scores.coverage.score).toBe(0);
    expect(scores.coverage.coveragePercent).toBe(0);
    expect(scores.coverage.components.map((component) => component.detail))
      .toEqual(['0/4 komponenti', '0/5 komponenti']);
  });
});

describe('B5 — growthRateScore piirväärtused on lukus', () => {
  // Ainult revenue (kaal 50): finalize jagab saadaoleva kaaluga, seega
  // growth.score === komponendi skoor. Nii testib see puhtalt growthRateScore'i.
  const cases: Array<[number, number]> = [
    [50, 100],
    [30, 100],
    [20, 85],
    [10, 70],
    [0, 50],
    [-10, 30],
    [-30, 0],
    [-50, 0],
  ];

  it.each(cases)('YoY %s%% annab Growth skoori %s', (yoy, expected) => {
    resetFixtureIds();
    const scores = calculateCompanyScores(makeFinancials({
      revenue: { value: 1_000, yoy },
    }));
    expect(scores.growth?.score).toBe(expected);
  });
});

describe('B6 — cash/debt piirväärtused on lukus', () => {
  // Ainult cash + debt (kaal 30): financialHealth.score === cash_debt skoor.
  const cases: Array<[number, number, number]> = [
    [500, 0, 100],
    [500, 250, 100],
    [200, 100, 100],
    [100, 100, 80],
    [50, 100, 55],
    [25, 100, 30],
    [0, 100, 0],
  ];

  it.each(cases)('cash %s / debt %s annab Health skoori %s', (cash, debt, expected) => {
    resetFixtureIds();
    const scores = calculateCompanyScores(makeFinancials({
      cash: { value: cash },
      debt: { value: debt },
    }));
    expect(scores.financialHealth?.score).toBe(expected);
    expect(scores.financialHealth?.components).toHaveLength(1);
    expect(scores.financialHealth?.components[0].id).toBe('cash_debt');
  });

  it('eri bilansipäevade cash ja debt jätavad komponendi ausalt välja', () => {
    const scores = calculateCompanyScores(makeFinancials({
      cash: { value: 500, latest: { periodEnd: '2026-06-30' } },
      debt: { value: 250, latest: { periodEnd: '2021-12-31' } },
    }));
    expect(scores.financialHealth).toBeNull();
    expect(scores.coverage.components[1].detail).toBe('0/5 komponenti');
  });
});

describe('B7 — lokaliseeritud stringid ei kuulu determinismi lubadusse', () => {
  // `percent()` (company-scores.ts:82) ja cashDebtComponent (rida 136) kasutavad
  // toLocaleString('et-EE'), mille väljund sõltub keskkonna ICU-st. Need stringid
  // jõuavad `detail` väljadesse ja sealt püsivasse score-snapshot payload'i.
  // Seetõttu assertime nende olemasolu, MITTE täpset sisu — muidu muutuksid
  // testid keskkondade vahel (konteiner vs GitHub Actions runner) flaky'ks.
  it('iga komponendi detail on mittetühi string', () => {
    const scores = calculateCompanyScores(fullyCoveredFinancials());
    const components = allComponents(scores);
    expect(components.length).toBeGreaterThan(0);
    for (const component of components) {
      expect(typeof component.detail).toBe('string');
      expect(component.detail.length).toBeGreaterThan(0);
    }
  });

  it('Coverage detailid on lokaadist sõltumatud ja seega täpselt assertitavad', () => {
    // Erinevalt growth/health detailidest on need puhtad template-stringid.
    const scores = calculateCompanyScores(fullyCoveredFinancials());
    expect(scores.coverage.components.map((component) => component.detail))
      .toEqual(['4/4 komponenti', '5/5 komponenti']);
  });

  it('skoorid on arvud, mitte lokaliseeritud stringid', () => {
    const scores = calculateCompanyScores(fullyCoveredFinancials());
    expect(Number.isInteger(scores.growth?.score)).toBe(true);
    expect(Number.isInteger(scores.financialHealth?.score)).toBe(true);
    expect(Number.isInteger(scores.coverage.score)).toBe(true);
  });
});
