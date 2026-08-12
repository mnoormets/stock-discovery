import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
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
            return_percent, measured_at, benchmark_status
     FROM candidate_outcomes WHERE horizon = $1`,
    [horizon],
  );
  expect(rows).toHaveLength(1);
  return rows[0];
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
