import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { SCORE_VERSION } from '../../src/lib/company-scores';
import { saveCompanyScoreSnapshot } from '../../src/lib/score-tracking';
import { insertCompany } from '../fixtures/company';
import { makeFinancials, resetFixtureIds } from '../fixtures/financials';
import { resetDb } from '../setup/reset';

// B8: score-snapshot'i dedupe.
//
// Testitav loogika: src/lib/score-tracking.ts:97-117 (`saveCompanyScoreSnapshot`).
//
//   input_hash = sha256({ version: SCORE_VERSION, ticker, sources })   rida 77
//   sources    = fact ID-d, periood ja väärtus iga mõõdiku kohta       read 63-73
//                (sorteeritud mõõdiku nime järgi, rida 76)
//   UNIQUE (company_id, scoring_version, input_hash)
//   ON CONFLICT DO UPDATE SET payload = EXCLUDED.payload               read 105-106
//
// NB: `yearOverYearPercent` EI ole sources'i osa, aga see on puhtalt tuletatud
// `latest.value`-st ja `previousComparable.value`-st (company-financials.ts:467-469),
// mis mõlemad ON sources'is. Seega päris faktimuutus muudab alati ka hash'i.

// Sama kuju iga kord: `resetFixtureIds()` tagab, et eraldi ehitatud fixture'id
// saavad identsed fact ID-d ja seega identse sources-jälje.
function revenueOnly(value: number, previousValue: number, yoy: number | null) {
  resetFixtureIds();
  return makeFinancials({ revenue: { value, previousValue, yoy } });
}

async function snapshotRows() {
  const { rows } = await pool.query(
    `SELECT s.id, s.scoring_version, s.input_hash, s.growth_score, s.health_score,
            s.coverage_score, s.payload, s.calculated_at
     FROM company_score_snapshots s
     ORDER BY s.id`,
  );
  return rows;
}

beforeEach(async () => {
  await resetDb();
  await insertCompany('TEST');
});

describe('B8 — kordussalvestus ei loo duplikaati', () => {
  it('sama sisend kaks korda annab ühe rea sama id ja hash\'iga', async () => {
    const financials = revenueOnly(1_000, 800, 25);

    const first = await saveCompanyScoreSnapshot(financials);
    const second = await saveCompanyScoreSnapshot(financials);

    expect(second.id).toBe(first.id);
    expect(second.inputHash).toBe(first.inputHash);
    expect(second.version).toBe(SCORE_VERSION);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].scoring_version).toBe(SCORE_VERSION);
  });

  it('calculated_at ei muutu kordussalvestusel', async () => {
    const financials = revenueOnly(1_000, 800, 25);

    await saveCompanyScoreSnapshot(financials);
    const afterFirst = (await snapshotRows())[0].calculated_at;

    await saveCompanyScoreSnapshot(financials);
    const afterSecond = (await snapshotRows())[0].calculated_at;

    // `calculated_at` ei ole ON CONFLICT SET nimekirjas (read 105-106). Kaks
    // eraldi päringut on eraldi transaktsioonid, seega now() ERINEKS, kui seda
    // uuendataks — võrdlus on sisukas ka ilma ootamiseta.
    expect(new Date(afterSecond).toISOString()).toBe(new Date(afterFirst).toISOString());
  });

  it('mõõdikute järjekord ei loo uut snapshot\'i', async () => {
    // `sourceTrace` loeb Object.entries kaudu (rida 64), aga sorteerib mõõdiku
    // nime järgi (rida 76). Seega võtmete järjekord ei tohi hash'i muuta.
    //
    // NB: `reversed` EI ole eraldi ehitatud fixture, vaid sama objekti
    // ümberjärjestatud koopia. Kaks eraldi `makeFinancials` kutset annaksid
    // erinevad fact ID-d (ID-d jagatakse iteratsioonijärjekorras) ja hash'id
    // erineksid õigustatult — siis testiks see hoopis ID-de mõju, mitte
    // võtmete järjekorda.
    resetFixtureIds();
    const forward = makeFinancials({
      revenue: { value: 1_000, previousValue: 800, yoy: 25 },
      cash: { value: 500 },
    });
    const reversed = {
      ...forward,
      metrics: {
        cash: forward.metrics.cash,
        revenue: forward.metrics.revenue,
      },
    };
    expect(Object.keys(forward.metrics)).toEqual(['revenue', 'cash']);
    expect(Object.keys(reversed.metrics)).toEqual(['cash', 'revenue']);

    const first = await saveCompanyScoreSnapshot(forward);
    const second = await saveCompanyScoreSnapshot(reversed);

    expect(second.inputHash).toBe(first.inputHash);
    expect(second.id).toBe(first.id);
    expect(await snapshotRows()).toHaveLength(1);
  });
});

describe('B8 — muutunud faktiseis loob uue snapshot\'i', () => {
  it('muutunud latest.value annab teise rea', async () => {
    const before = await saveCompanyScoreSnapshot(revenueOnly(1_000, 800, 25));
    const after = await saveCompanyScoreSnapshot(revenueOnly(1_200, 800, 50));

    expect(after.id).not.toBe(before.id);
    expect(after.inputHash).not.toBe(before.inputHash);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(2);
    // Mõlemad kuuluvad samale ettevõttele ja samale score-versioonile:
    // ajalugu kasvab, vana rida ei kirjutata üle.
    expect(new Set(rows.map((row) => row.scoring_version))).toEqual(new Set([SCORE_VERSION]));
    expect(new Set(rows.map((row) => row.input_hash)).size).toBe(2);
  });

  it('muutunud previousComparable.value annab samuti teise rea', async () => {
    const before = await saveCompanyScoreSnapshot(revenueOnly(1_000, 800, 25));
    const after = await saveCompanyScoreSnapshot(revenueOnly(1_000, 500, 100));

    expect(after.inputHash).not.toBe(before.inputHash);
    expect(await snapshotRows()).toHaveLength(2);
  });
});

describe('B8 — ON CONFLICT uuendab ainult payload\'i', () => {
  it('KARAKTERISEERIV: skoori veerud jäävad vanaks, payload uueneb', async () => {
    // See simuleerib AINSAT olukorda, kus sama hash saab anda teised skoorid:
    // skoorivalem või kaalud muutuvad ilma SCORE_VERSION-i tõstmata (versioon
    // on hash'i sees, rida 77). Päris faktimuutus seda seisu ei tekita, sest
    // YoY on tuletatud sources'is olevatest väärtustest.
    //
    // Fixture'is hoiame väärtused (ja seega sources'i ning hash'i) samad, aga
    // anname erineva YoY — see muudab skoori, mitte hash'i.
    const highYoy = revenueOnly(1_000, 800, 25);   // growthRateScore(25) -> 93
    const zeroYoy = revenueOnly(1_000, 800, 0);    // growthRateScore(0)  -> 50

    const first = await saveCompanyScoreSnapshot(highYoy);
    expect(first.inputHash).toBeTruthy();
    const beforeRow = (await snapshotRows())[0];
    expect(beforeRow.growth_score).toBe(93);
    expect(beforeRow.payload.scores.growth.score).toBe(93);

    const second = await saveCompanyScoreSnapshot(zeroYoy);
    // Sama hash → sama rida, mitte uus.
    expect(second.id).toBe(first.id);
    expect(second.inputHash).toBe(first.inputHash);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(1);
    // payload uuenes...
    expect(rows[0].payload.scores.growth.score).toBe(50);
    // ...aga growth_score veerg EI ole ON CONFLICT SET nimekirjas ja jäi vanaks.
    expect(rows[0].growth_score).toBe(93);

    // Kui keegi laiendab SET klauslit (nt growth_score = EXCLUDED.growth_score),
    // peab see test muutuma TEADLIKULT. Praegu dokumenteerib see, et veerud ja
    // payload võivad lahku minna täpselt siis, kui valem muutub ilma
    // versiooni tõstmata — mistõttu SCORE_VERSION-i tõstmine on kohustuslik.
  });
});

describe('B8 — snapshot nõuab olemasolevat ettevõtet', () => {
  it('tundmatu ticker viskab erindi, mitte ei loo orvu rida', async () => {
    resetFixtureIds();
    const orphan = makeFinancials({ revenue: { value: 1_000, previousValue: 800, yoy: 25 } }, {
      ticker: 'NOPE',
    });

    await expect(saveCompanyScoreSnapshot(orphan)).rejects.toThrow(/NOPE/);
    expect(await snapshotRows()).toHaveLength(0);
  });
});
