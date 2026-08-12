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

describe('D1 — test-andmebaasi isolatsioon (esimene värav)', () => {
  it('on ühendatud _test-lõpulise andmebaasiga, mis ei ole discovery', async () => {
    const { rows } = await pool.query('SELECT current_database() AS db');
    const connected = String(rows[0].db);
    expect(connected).not.toBe('discovery');
    expect(connected.endsWith('_test')).toBe(true);
    expect(connected).toBe(TEST_DB_NAME);
  });

  it('ei näe tootmise ridu — investment_theses on tühi', async () => {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM investment_theses');
    expect(rows[0].n).toBe(0);
  });

  it('ei näe tootmise canonical discovery jookse', async () => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM discovery_runs WHERE run_type = 'rklb_daily'`,
    );
    expect(rows[0].n).toBe(0);
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
  beforeEach(async () => {
    await resetDb();
  });

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
