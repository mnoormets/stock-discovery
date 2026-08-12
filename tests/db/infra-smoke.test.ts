import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { TEST_DB_NAME } from '../setup/test-db-url';
import { publicTables, resetDb } from '../setup/reset';

// `ensureSchema()` (src/lib/db.ts:256-671) tabelikomplekt on siia fikseeritud
// KARAKTERISEERIVA testina: see ei väida, mis peaks olema, vaid lukustab selle,
// mis praegu on. Kui versioonitud migratsioonid (TOP 9) skeemi koondavad, peab
// see nimekiri muutuma teadlikult, mitte kogemata.
const ENSURE_SCHEMA_TABLES = [
  'alerts',
  'analyst_targets',
  'candidate_outcomes',
  'catalyst_assessments',
  'catalyst_events',
  'companies',
  'company_score_snapshots',
  'discovery_decisions',
  'discovery_runs',
  'earnings_events',
  'financial_facts',
  'investment_theses',
  'news_items',
  'portfolio_positions',
  'price_snapshots',
  'research_briefs',
  'sec_events',
  'sec_suspensions',
  'snapshots',
  'thesis_change_events',
];

// Kõik selle faili testid algavad puhtalt lehelt. Ilma selleta sõltuksid
// alljärgnevad tühjuse-assertsioonid sellest, mitmendana see fail jookseb —
// teised DB-testifailid jätavad ridu maha.
beforeEach(async () => {
  await resetDb();
});

describe('D1 — test-andmebaasi isolatsioon (esimene värav)', () => {
  it('on ühendatud _test-lõpulise andmebaasiga, mis ei ole discovery', async () => {
    const { rows } = await pool.query('SELECT current_database() AS db');
    const connected = String(rows[0].db);
    expect(connected).not.toBe('discovery');
    expect(connected.endsWith('_test')).toBe(true);
    expect(connected).toBe(TEST_DB_NAME);
  });

  // NB: see ei tõesta, et tootmine on puutumata — seda tõestab ülemine test
  // koos guard.ts K1/K2 kihiga. Siin tõestatakse, et me oleme ühendatud
  // kustutatava andmebaasiga, mille sisu on testide kontrolli all.
  it('töötab tühjendatava andmebaasiga: portfelli tabelid on pärast reset\'i tühjad', async () => {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM investment_theses) AS theses,
              (SELECT count(*)::int FROM portfolio_positions) AS positions,
              (SELECT count(*)::int FROM discovery_runs WHERE run_type = 'rklb_daily') AS canonical`,
    );
    expect(rows[0].theses).toBe(0);
    expect(rows[0].positions).toBe(0);
    expect(rows[0].canonical).toBe(0);
  });
});

describe('D2 — ensureSchema() tabelikomplekt', () => {
  it('loob täpselt need 20 tabelit', async () => {
    const tables = await publicTables();
    expect(tables).toEqual(ENSURE_SCHEMA_TABLES);
  });

  it('EI loo financial_enrichment_status — see kuulub company-financials.ts-ile', async () => {
    // Tõend kahe skeemiomaniku kohta: tootmisbaasis on 21 tabelit, ensureSchema
    // katab neist 20. See on TOP 9 (versioonitud migratsioonid) mõõdetav alus.
    const tables = await publicTables();
    expect(tables).not.toContain('financial_enrichment_status');
  });
});

describe('D3 — resetDb()', () => {
  it('lähtestab ka identity-sekventsid', async () => {
    const first = await pool.query(`INSERT INTO companies (ticker) VALUES ('TEST') RETURNING id`);
    expect(Number(first.rows[0].id)).toBe(1);

    await resetDb();

    const second = await pool.query(`INSERT INTO companies (ticker) VALUES ('TEST') RETURNING id`);
    expect(Number(second.rows[0].id)).toBe(1);
  });

  it('tühjendab kirjutatud read', async () => {
    await pool.query(`INSERT INTO companies (ticker) VALUES ('AAA'), ('BBB')`);
    const before = await pool.query('SELECT count(*)::int AS n FROM companies');
    expect(before.rows[0].n).toBe(2);

    await resetDb();

    const after = await pool.query('SELECT count(*)::int AS n FROM companies');
    expect(after.rows[0].n).toBe(0);
  });
});
