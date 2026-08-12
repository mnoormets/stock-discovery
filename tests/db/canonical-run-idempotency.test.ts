import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  DISCOVERY_MODEL_VERSION,
  OUTCOME_HORIZONS,
  recordDiscoveryRun,
} from '../../src/lib/discovery-validation';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

// A-blokk: canonical discovery run'i idempotentsus.
//
// Testitav loogika: src/lib/discovery-validation.ts:199-359 (`recordDiscoveryRun`).
// Kriitiline detail, mille peal kogu "üks canonical run Tallinna päeva kohta"
// garantii seisab (read 208-210):
//
//   canonical: `${VERSION}:${runType}:${decisionDate}`   <- input-hash PUUDUB
//   manual:    `${VERSION}:${decisionDate}:${hash}`      <- input-hash SEES
//
// Seega canonical kordusjooks taaskasutab sama päeva snapshot'i ka siis, kui
// sisend on vahepeal muutunud — ja märgib selle eraldi lipuga.

const CANONICAL = 'rklb_daily';

async function countRuns(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM discovery_runs');
  return rows[0].n;
}

async function countDecisions(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM discovery_decisions');
  return rows[0].n;
}

async function countOutcomes(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM candidate_outcomes');
  return rows[0].n;
}

beforeEach(async () => {
  await resetDb();
});

describe('A1 — canonical run-key ignoreerib input-hash\'i', () => {
  it('sama Tallinna päev taaskasutab run\'i ka muutunud sisendiga', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const aaa = await insertCompany('AAA');

    const first = await recordDiscoveryRun(
      ['rule-a'],
      [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })],
      runAt,
      CANONICAL,
    );
    expect(first.created).toBe(true);
    expect(first.evaluatedCount).toBe(1);

    // Teine jooks samal Tallinna päeval, AGA erineva sisendiga.
    const bbb = await insertCompany('BBB');
    const second = await recordDiscoveryRun(
      ['rule-a'],
      [
        makeDecisionInput({ companyId: aaa, ticker: 'AAA' }),
        makeDecisionInput({ companyId: bbb, ticker: 'BBB' }),
      ],
      runAt,
      CANONICAL,
    );

    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    // Tagastatakse SALVESTATUD väärtused, mitte uue sisendi omad.
    expect(second.evaluatedCount).toBe(1);
    expect(second.inputChangedAfterCanonicalSnapshot).toBe(true);
    expect(await countRuns()).toBe(1);
  });
});

describe('A2 — identne kordus ei märgi sisendimuutust', () => {
  it('created=false ja inputChangedAfterCanonicalSnapshot=false', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const aaa = await insertCompany('AAA');
    const decisions = [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })];

    const first = await recordDiscoveryRun(['rule-a'], decisions, runAt, CANONICAL);
    const second = await recordDiscoveryRun(['rule-a'], decisions, runAt, CANONICAL);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(second.inputChangedAfterCanonicalSnapshot).toBe(false);
    expect(await countRuns()).toBe(1);
  });

  it('salvestab mudeliversiooni ja run_key kuju', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const aaa = await insertCompany('AAA');
    await recordDiscoveryRun(
      ['rule-a'],
      [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })],
      runAt,
      CANONICAL,
    );

    const { rows } = await pool.query(
      'SELECT run_key, model_version, run_type, decision_date FROM discovery_runs',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].model_version).toBe(DISCOVERY_MODEL_VERSION);
    expect(rows[0].run_type).toBe(CANONICAL);
    expect(rows[0].run_key).toBe(`${DISCOVERY_MODEL_VERSION}:${CANONICAL}:2026-03-10`);
  });
});

describe('A3 — kordusjooks ei loo otsuseid ega outcome\'e', () => {
  it('discovery_decisions ja candidate_outcomes jäävad muutumatuks', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const aaa = await insertCompany('AAA');

    await recordDiscoveryRun(
      ['rule-a'],
      [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })],
      runAt,
      CANONICAL,
    );

    const decisionsAfterFirst = await countDecisions();
    const outcomesAfterFirst = await countOutcomes();
    expect(decisionsAfterFirst).toBe(1);
    expect(outcomesAfterFirst).toBe(OUTCOME_HORIZONS.length);

    // Kordusjooks muutunud sisendiga: kogu insert-plokk on `if (created)` sees
    // (rida 256), seega ridu ei tohi lisanduda.
    const bbb = await insertCompany('BBB');
    await recordDiscoveryRun(
      ['rule-a'],
      [
        makeDecisionInput({ companyId: aaa, ticker: 'AAA' }),
        makeDecisionInput({ companyId: bbb, ticker: 'BBB' }),
      ],
      runAt,
      CANONICAL,
    );

    expect(await countDecisions()).toBe(decisionsAfterFirst);
    expect(await countOutcomes()).toBe(outcomesAfterFirst);
    // BBB ei jõudnud salvestatud snapshot'i.
    const { rows } = await pool.query('SELECT ticker FROM discovery_decisions ORDER BY ticker');
    expect(rows.map((row) => row.ticker)).toEqual(['AAA']);
  });

  it('loob täpselt viis outcome-rida kaasatud kandidaadi kohta', async () => {
    const runAt = new Date('2026-03-10T09:00:00.000Z');
    const aaa = await insertCompany('AAA');
    await recordDiscoveryRun(
      ['rule-a'],
      [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })],
      runAt,
      CANONICAL,
    );

    const { rows } = await pool.query('SELECT horizon FROM candidate_outcomes ORDER BY horizon');
    expect(rows.map((row) => row.horizon).sort()).toEqual([...OUTCOME_HORIZONS].sort());
  });
});

describe('A7 — Tallinna päevapiir (prioriteetne)', () => {
  // `tallinnDate` (discovery-validation.ts:155-162) on ainus päevavõtme
  // autoriteet. Suvel on Tallinn UTC+3, talvel UTC+2 — see test tõestab, et
  // nihe ei ole koodi sisse kirjutatud, vaid tuleb tsooniandmetest.
  const cases: Array<[string, string, string]> = [
    ['suvi, vahetult enne keskööd', '2026-08-12T20:59:00.000Z', '2026-08-12'],
    ['suvi, täpselt kesköö', '2026-08-12T21:00:00.000Z', '2026-08-13'],
    ['talv, vahetult enne keskööd', '2026-01-15T21:59:00.000Z', '2026-01-15'],
    ['talv, täpselt kesköö', '2026-01-15T22:00:00.000Z', '2026-01-16'],
  ];

  it.each(cases)('%s: %s → decision_date %s', async (_label, iso, expected) => {
    const aaa = await insertCompany('AAA');
    const result = await recordDiscoveryRun(
      ['rule-a'],
      [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })],
      new Date(iso),
      CANONICAL,
    );
    expect(result.decisionDate).toBe(expected);

    const { rows } = await pool.query(
      `SELECT to_char(decision_date, 'YYYY-MM-DD') AS d FROM discovery_runs`,
    );
    expect(rows[0].d).toBe(expected);
  });

  it('sama UTC päev üle Tallinna keskööd annab KAKS canonical run\'i', async () => {
    const aaa = await insertCompany('AAA');
    const decisions = [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })];

    const before = await recordDiscoveryRun(
      ['rule-a'], decisions, new Date('2026-08-12T20:59:00.000Z'), CANONICAL,
    );
    const after = await recordDiscoveryRun(
      ['rule-a'], decisions, new Date('2026-08-12T21:30:00.000Z'), CANONICAL,
    );

    expect(before.decisionDate).toBe('2026-08-12');
    expect(after.decisionDate).toBe('2026-08-13');
    expect(before.created).toBe(true);
    expect(after.created).toBe(true);
    expect(after.runId).not.toBe(before.runId);
    expect(await countRuns()).toBe(2);
  });

  it('kaks eri UTC päeva sama Tallinna päeva sees annavad ÜHE canonical run\'i', async () => {
    const aaa = await insertCompany('AAA');
    const decisions = [makeDecisionInput({ companyId: aaa, ticker: 'AAA' })];

    // 21:30Z 12. aug = 00:30 Tallinn 13. aug; 05:00Z 13. aug = 08:00 Tallinn 13. aug.
    const night = await recordDiscoveryRun(
      ['rule-a'], decisions, new Date('2026-08-12T21:30:00.000Z'), CANONICAL,
    );
    const morning = await recordDiscoveryRun(
      ['rule-a'], decisions, new Date('2026-08-13T05:00:00.000Z'), CANONICAL,
    );

    expect(night.decisionDate).toBe('2026-08-13');
    expect(morning.decisionDate).toBe('2026-08-13');
    expect(night.created).toBe(true);
    expect(morning.created).toBe(false);
    expect(morning.runId).toBe(night.runId);
    expect(await countRuns()).toBe(1);
  });
});
