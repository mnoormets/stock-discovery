import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  DEFAULT_BENCHMARK_SYMBOL,
  recordDiscoveryRun,
  refreshCandidateOutcomes,
} from '../../src/lib/discovery-validation';
import { insertCompany } from '../fixtures/company';
import { insertPriceSnapshot } from '../fixtures/price';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

// C-blokk: outcome'ide mõõtmine ja mõõdetud ajaloo muutumatus.
//
// Testitav loogika: src/lib/discovery-validation.ts:361-488
// (`refreshCandidateOutcomes`). Aeg on parameeter (`now`), seega kogu elutsükkel
// on determinstlikult testitav ilma kella mockimata.
//
// Kaitse, mille peal muutumatus seisab: iga UPDATE lõpeb tingimusega
// `WHERE id = $1 AND status <> 'measured'` (read 378, 399, 406) ja ka valik ise
// filtreerib mõõdetud read välja (rida 367).

const CANONICAL = 'rklb_daily';
const BASELINE_PRICE = 100;

async function seedCanonicalRun(
  runAt: Date,
  options: { ticker?: string; decisionPrice?: number | null } = {},
): Promise<{ companyId: number; runId: number }> {
  const ticker = options.ticker ?? 'AAA';
  const companyId = await insertCompany(ticker);
  const record = await recordDiscoveryRun(
    ['rule-a'],
    [makeDecisionInput({
      companyId,
      ticker,
      included: true,
      decisionPrice: options.decisionPrice === undefined ? BASELINE_PRICE : options.decisionPrice,
    })],
    runAt,
    CANONICAL,
  );
  return { companyId, runId: record.runId };
}

async function outcomeByHorizon(horizon: string) {
  const { rows } = await pool.query(
    `SELECT id, horizon, status, target_at, observed_at, observed_price,
            return_percent, measured_at, benchmark_symbol, benchmark_status,
            benchmark_start_at, benchmark_end_at, benchmark_price_start,
            benchmark_price_end, benchmark_return_percent, excess_return_percent
     FROM candidate_outcomes WHERE horizon = $1`,
    [horizon],
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

// Benchmark'i algushind korjatakse juba run'i salvestamisel
// (discovery-validation.ts:259-269), seega SPY read peavad eksisteerima ENNE
// `seedCanonicalRun`-i, kui tahame realistlikku teed.
async function seedBenchmarkPrices(entries: Array<[number, string]>): Promise<number> {
  const spyId = await insertCompany(DEFAULT_BENCHMARK_SYMBOL);
  for (const [price, capturedAt] of entries) {
    await insertPriceSnapshot(spyId, price, capturedAt, 'test-benchmark');
  }
  return spyId;
}

function iso(value: unknown): string {
  return new Date(value as string).toISOString();
}

beforeEach(async () => {
  await resetDb();
});

describe('C1 — mõõdetud outcome\'i ei kirjutata kunagi üle', () => {
  it('hilisem, soodsam hind samas aknas ei muuda mõõdetud rida', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);

    // 1w sihtaeg = runAt + 7 päeva.
    await insertPriceSnapshot(companyId, 110, '2026-03-17T09:00:00.000Z');
    const changed = await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));
    expect(changed).toBeGreaterThan(0);

    const measured = await outcomeByHorizon('1w');
    expect(measured.status).toBe('measured');
    expect(Number(measured.observed_price)).toBe(110);
    expect(Number(measured.return_percent)).toBe(10);
    expect(measured.measured_at).not.toBeNull();

    // Lisame hiljem oluliselt kõrgema hinna samasse 7-päevasesse aknasse ja
    // jooksutame refresh'i uuesti. Mõõdetud ajalugu ei tohi paraneda.
    await insertPriceSnapshot(companyId, 200, '2026-03-17T10:00:00.000Z');
    await refreshCandidateOutcomes(new Date('2026-03-19T00:00:00.000Z'));

    const after = await outcomeByHorizon('1w');
    expect(after.status).toBe('measured');
    expect(Number(after.observed_price)).toBe(110);
    expect(Number(after.return_percent)).toBe(10);
    expect(iso(after.observed_at)).toBe(iso(measured.observed_at));
    expect(iso(after.measured_at)).toBe(iso(measured.measured_at));
  });

  it('korduv refresh ei loe mõõdetud rida enam muutuseks', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);
    await insertPriceSnapshot(companyId, 110, '2026-03-17T09:00:00.000Z');

    const first = await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));
    const second = await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});

describe('C2 — mõõdetud benchmark\'i ei kirjutata üle', () => {
  it('hilisem, soodsam SPY hind ei muuda mõõdetud benchmark\'i ega excess return\'i', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    // SPY algushind peab olema olemas enne run'i salvestamist.
    const spyId = await seedBenchmarkPrices([[500, '2026-03-10T08:00:00.000Z']]);
    const { companyId } = await seedCanonicalRun(runAt);

    // Kandidaat: 100 -> 110 = +10%. Benchmark: 500 -> 525 = +5%. Excess = +5.
    await insertPriceSnapshot(companyId, 110, '2026-03-17T09:00:00.000Z');
    await insertPriceSnapshot(spyId, 525, '2026-03-17T09:00:00.000Z', 'test-benchmark');
    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const measured = await outcomeByHorizon('1w');
    expect(measured.status).toBe('measured');
    expect(measured.benchmark_status).toBe('measured');
    expect(measured.benchmark_symbol).toBe(DEFAULT_BENCHMARK_SYMBOL);
    expect(Number(measured.benchmark_price_start)).toBe(500);
    expect(Number(measured.benchmark_price_end)).toBe(525);
    expect(Number(measured.benchmark_return_percent)).toBe(5);
    expect(Number(measured.excess_return_percent)).toBe(5);

    // Anti-cheat: hilisem SPY hind samas aknas ei tohi benchmark'i ümber arvutada
    // (discovery-validation.ts:413-415, kaitse real 468).
    await insertPriceSnapshot(spyId, 1_000, '2026-03-17T10:00:00.000Z', 'test-benchmark');
    await refreshCandidateOutcomes(new Date('2026-03-19T00:00:00.000Z'));

    const after = await outcomeByHorizon('1w');
    expect(after.benchmark_status).toBe('measured');
    expect(Number(after.benchmark_price_end)).toBe(525);
    expect(Number(after.benchmark_return_percent)).toBe(5);
    expect(Number(after.excess_return_percent)).toBe(5);
    expect(iso(after.benchmark_start_at)).toBe(iso(measured.benchmark_start_at));
    expect(iso(after.benchmark_end_at)).toBe(iso(measured.benchmark_end_at));
  });
});

describe('C3 — enne sihtaega outcome\'i ei puututa', () => {
  it('kõik viis rida jäävad pending ja measured_at jääb null', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);

    // Hind on olemas, aga ükski sihtaeg ei ole veel käes (varaseim on +7 päeva).
    await insertPriceSnapshot(companyId, 150, '2026-03-11T09:00:00.000Z');

    const changed = await refreshCandidateOutcomes(new Date('2026-03-11T12:00:00.000Z'));
    expect(changed).toBe(0);

    const { rows } = await pool.query(
      `SELECT status, measured_at, observed_at, observed_price, return_percent
       FROM candidate_outcomes`,
    );
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.status).toBe('pending');
      expect(row.measured_at).toBeNull();
      expect(row.observed_at).toBeNull();
      expect(row.observed_price).toBeNull();
      expect(row.return_percent).toBeNull();
    }
  });
});

describe('C4 — esimene hind sihtajast alates võidab', () => {
  it('valik käib captured_at järgi, mitte sisestusjärjekorra ega hinnataseme järgi', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);

    // Sisestusjärjekord on teadlikult "vale": kõrgeim hind saab väikseima id.
    // Nii tõestab test, et järjestus tuleb captured_at-st (rida 389), mitte id-st.
    await insertPriceSnapshot(companyId, 130, '2026-03-17T11:00:00.000Z');
    // See on ENNE sihtaega (09:00) — akna alumine piir peab selle välistama.
    await insertPriceSnapshot(companyId, 999, '2026-03-17T08:00:00.000Z');
    await insertPriceSnapshot(companyId, 105, '2026-03-17T10:00:00.000Z');

    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const outcome = await outcomeByHorizon('1w');
    expect(outcome.status).toBe('measured');
    expect(Number(outcome.observed_price)).toBe(105);
    expect(iso(outcome.observed_at)).toBe('2026-03-17T10:00:00.000Z');
    expect(Number(outcome.return_percent)).toBe(5);
  });
});

describe('C5 — 7-päevane mõõtmisaken', () => {
  it('akna väline hind ei mõõda; akna möödudes tuleb status=missing', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);

    // 1w sihtaeg = 2026-03-17T09:00Z, aken on [sihtaeg, sihtaeg + 7 päeva).
    // See hind on 8 päeva pärast sihtaega ehk aknast väljas.
    await insertPriceSnapshot(companyId, 130, '2026-03-25T09:00:00.000Z');

    // Aken on veel lahti (now < sihtaeg + 7 päeva) → ei mõõda ega märgi puuduvaks.
    await refreshCandidateOutcomes(new Date('2026-03-20T09:00:00.000Z'));
    const stillOpen = await outcomeByHorizon('1w');
    expect(stillOpen.status).toBe('pending');
    expect(stillOpen.measured_at).toBeNull();

    // Aken sulgus (rida 403) → missing, mitte measured ja mitte 0% tootlus.
    await refreshCandidateOutcomes(new Date('2026-03-25T09:00:00.000Z'));
    const closed = await outcomeByHorizon('1w');
    expect(closed.status).toBe('missing');
    expect(closed.measured_at).not.toBeNull();
    expect(closed.observed_price).toBeNull();
    expect(closed.return_percent).toBeNull();
  });

  it('missing EI ole lukustatud olek: hiljem saabunud aknasisene hind mõõdab ära', async () => {
    // Kaitse on `status <> 'measured'`, mitte `= 'pending'` (read 367, 399).
    // Seega ainult `measured` on lõplik. See on teadlik: hilinenud hinnaandmed
    // peavad saama mõõdetud. Test dokumenteerib selle, et keegi ei eeldaks
    // ekslikult, nagu oleks `missing` samamoodi muutumatu.
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt);
    await insertPriceSnapshot(companyId, 130, '2026-03-25T09:00:00.000Z');

    await refreshCandidateOutcomes(new Date('2026-03-25T09:00:00.000Z'));
    expect((await outcomeByHorizon('1w')).status).toBe('missing');

    // Hilinenud hind, mis kuulub 1w aknasse [03-17, 03-24).
    await insertPriceSnapshot(companyId, 120, '2026-03-18T09:00:00.000Z');
    await refreshCandidateOutcomes(new Date('2026-03-26T09:00:00.000Z'));

    const remeasured = await outcomeByHorizon('1w');
    expect(remeasured.status).toBe('measured');
    expect(Number(remeasured.observed_price)).toBe(120);
    expect(Number(remeasured.return_percent)).toBe(20);
  });
});

describe('C6 — kasutamiskõlbmatu baashind', () => {
  it('null decision_price annab status=unavailable, mitte 0% tootluse', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const { companyId } = await seedCanonicalRun(runAt, { decisionPrice: null });

    // Hind on olemas, aga baasjoon puudub, seega tootlust ei saa arvutada.
    await insertPriceSnapshot(companyId, 110, '2026-03-17T09:00:00.000Z');
    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const outcome = await outcomeByHorizon('1w');
    expect(outcome.status).toBe('unavailable');
    expect(outcome.measured_at).not.toBeNull();
    expect(outcome.observed_price).toBeNull();
    expect(outcome.return_percent).toBeNull();
  });

  it('null baashind ei mõjuta veel mittesaabunud horisonte', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    await seedCanonicalRun(runAt, { decisionPrice: null });
    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const { rows } = await pool.query(
      `SELECT status, count(*)::int AS n FROM candidate_outcomes GROUP BY status ORDER BY status`,
    );
    // Ainult 1w on saabunud; ülejäänud neli jäävad pending.
    expect(rows).toEqual([
      { status: 'pending', n: 4 },
      { status: 'unavailable', n: 1 },
    ]);
  });
});

describe('C7 — excess return ja puuduv benchmark', () => {
  it('excess_return_percent = kandidaadi tootlus miinus benchmark\'i tootlus', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const spyId = await seedBenchmarkPrices([[400, '2026-03-10T08:00:00.000Z']]);
    const { companyId } = await seedCanonicalRun(runAt);

    // Kandidaat: 100 -> 130 = +30%. Benchmark: 400 -> 440 = +10%. Excess = +20.
    await insertPriceSnapshot(companyId, 130, '2026-03-17T09:00:00.000Z');
    await insertPriceSnapshot(spyId, 440, '2026-03-17T09:00:00.000Z', 'test-benchmark');
    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const outcome = await outcomeByHorizon('1w');
    expect(Number(outcome.return_percent)).toBe(30);
    expect(Number(outcome.benchmark_return_percent)).toBe(10);
    expect(Number(outcome.excess_return_percent)).toBe(20);
    expect(Number(outcome.excess_return_percent))
      .toBe(Number(outcome.return_percent) - Number(outcome.benchmark_return_percent));
  });

  it('puuduv benchmark jätab benchmark- ja excess-välja NULL-iks, mitte nulliks', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    // Ühtki SPY rida ei eksisteeri.
    const { companyId } = await seedCanonicalRun(runAt);
    await insertPriceSnapshot(companyId, 110, '2026-03-17T09:00:00.000Z');
    await refreshCandidateOutcomes(new Date('2026-03-18T00:00:00.000Z'));

    const outcome = await outcomeByHorizon('1w');
    // Kandidaadi tootlus on mõõdetud...
    expect(outcome.status).toBe('measured');
    expect(Number(outcome.return_percent)).toBe(10);
    // ...aga benchmark jääb teadmata, mitte 0.
    expect(outcome.benchmark_status).toBe('pending');
    expect(outcome.benchmark_price_start).toBeNull();
    expect(outcome.benchmark_price_end).toBeNull();
    expect(outcome.benchmark_return_percent).toBeNull();
    expect(outcome.excess_return_percent).toBeNull();
  });
});

describe('C8 — horisondi target_at arvutus', () => {
  // `horizonTarget` (read 184-197) on privaatne funktsioon, seega testitakse seda
  // salvestatud candidate_outcomes.target_at kaudu.
  //
  // NB: erinevalt `decision_date`-st (mis on Tallinna-põhine, vt A7) on need
  // arvutused puhtalt UTC-s (setUTCDate / setUTCMonth), seega kellaaeg 12:00Z
  // säilib ka üle suve/talveaja piiri.

  async function targetsFor(runAt: string): Promise<Record<string, string>> {
    await seedCanonicalRun(new Date(runAt));
    const { rows } = await pool.query(
      'SELECT horizon, target_at FROM candidate_outcomes ORDER BY target_at',
    );
    return Object.fromEntries(rows.map((row) => [row.horizon, iso(row.target_at)]));
  }

  it('kuu viimane päev clamp\'itakse lühema kuu viimaseks päevaks', async () => {
    const targets = await targetsFor('2026-01-31T12:00:00.000Z');
    expect(targets).toEqual({
      '1w': '2026-02-07T12:00:00.000Z',
      '2w': '2026-02-14T12:00:00.000Z',
      // 31. veebruari ei ole: clamp veebruari viimasele päevale (2026 ei ole liigaasta).
      '1m': '2026-02-28T12:00:00.000Z',
      // Aprillis on 30 päeva.
      '3m': '2026-04-30T12:00:00.000Z',
      // Juulis on 31 päeva, seega clamp'i ei toimu.
      '6m': '2026-07-31T12:00:00.000Z',
    });
  });

  it('kuu keskel clamp\'i ei toimu ja kuupäev säilib', async () => {
    const targets = await targetsFor('2026-03-15T12:00:00.000Z');
    expect(targets).toEqual({
      '1w': '2026-03-22T12:00:00.000Z',
      '2w': '2026-03-29T12:00:00.000Z',
      '1m': '2026-04-15T12:00:00.000Z',
      '3m': '2026-06-15T12:00:00.000Z',
      '6m': '2026-09-15T12:00:00.000Z',
    });
  });
});


describe('quote-time integrity across all price writers', () => {
  it('rejects unknown, pre-target and future quote times for both stock and SPY', async () => {
    const spyId = await seedBenchmarkPrices([[100, '2026-09-01T12:00:00Z']]);
    const { companyId } = await seedCanonicalRun(new Date('2026-09-01T12:00:00Z'));
    for (const id of [companyId, spyId]) {
      await insertPriceSnapshot(id, 150, '2026-09-08T12:01:00Z', 'yahoo', null);
      await insertPriceSnapshot(id, 140, '2026-09-08T12:02:00Z', 'yahoo', '2026-09-07T20:00:00Z');
      await insertPriceSnapshot(id, 130, '2026-09-08T12:03:00Z', 'yahoo', '2026-09-09T12:00:00Z');
      await insertPriceSnapshot(id, 125, '2026-09-10T12:00:00Z', 'yahoo', '2026-09-10T12:00:00Z');
    }
    await refreshCandidateOutcomes(new Date('2026-09-08T14:00:00Z'));
    expect((await outcomeByHorizon('1w')).status).toBe('pending');

    await insertPriceSnapshot(companyId, 110, '2026-09-08T13:30:00Z', 'yahoo', '2026-09-08T13:29:00Z');
    await refreshCandidateOutcomes(new Date('2026-09-08T14:00:00Z'));
    const stockOnly = await outcomeByHorizon('1w');
    expect(stockOnly.status).toBe('measured');
    expect(stockOnly.benchmark_status).toBe('pending');
    expect(Number(stockOnly.return_percent)).toBe(10);

    await insertPriceSnapshot(spyId, 102, '2026-09-08T13:31:00Z', 'yahoo', '2026-09-08T13:30:00Z');
    await refreshCandidateOutcomes(new Date('2026-09-08T14:00:00Z'));
    const measured = await outcomeByHorizon('1w');
    expect(measured.benchmark_status).toBe('measured');
    expect(Number(measured.excess_return_percent)).toBe(8);
    await refreshCandidateOutcomes(new Date('2026-09-08T14:00:00Z'));
    expect(await outcomeByHorizon('1w')).toEqual(measured);
  });
});
