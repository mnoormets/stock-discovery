import { beforeEach, describe, expect, inject, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { TEST_DB_NAME } from '../setup/test-db-url';
import { publicTables, resetDb } from '../setup/reset';

// Testibaasi tabelikomplekt on siia fikseeritud KARAKTERISEERIVA testina: see
// ei väida, mis peaks olema, vaid lukustab selle, mis praegu on.
//
// TOP 9 Slice 1b: skeem tuleb nüüd VERSIOONITUD MIGRATSIOONIDEST, mitte
// `ensureSchema()`-st. Nimekiri muutus seetõttu TEADLIKULT ja kasvas 20 -> 22:
//   + financial_enrichment_status  (kuulus varem ainult company-financials.ts-ile;
//                                   migratsioonis on skeem koondatud)
//   + schema_migrations            (runneri raamatupidamine)
const MIGRATED_TABLES = [
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
  'financial_enrichment_status',
  'financial_facts',
  'investment_theses',
  'news_items',
  'portfolio_positions',
  'price_snapshots',
  'research_briefs',
  'schema_migrations',
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

describe('D2 — migratsioonidest ehitatud tabelikomplekt', () => {
  // Assertitakse globalSetup'is fikseeritud hetkeseisu, MITTE jooksvat
  // `pg_tables` vastu: testibaas on failide vahel jagatud.
  it('loob täpselt need 22 tabelit', () => {
    expect(inject('migratedTables')).toEqual(MIGRATED_TABLES);
  });

  it('koondab ka financial_enrichment_status — skeem ei ole enam kahe omaniku vahel', () => {
    // Enne Slice 1b-d lõi selle ainult `ensureFinancialSchema()` enrichment-koodi
    // esimesel käivitusel. Migratsioonis on see baseline'i osa.
    expect(inject('migratedTables')).toContain('financial_enrichment_status');
  });

  it('jooksev tabelihulk sisaldab vähemalt migreeritud komplekti', async () => {
    const live = await publicTables();
    for (const table of inject('migratedTables')) {
      expect(live).toContain(table);
    }
  });
});

describe('D4 — testibaas on ehitatud migratsioonidest', () => {
  // `appliedMigrations` fikseeritakse globalSetup'is ENNE ühtki resetDb()-d.
  // Otse `schema_migrations` vastu assertimine oleks katki, sest resetDb()
  // TRUNCATE'ib ka selle tabeli.
  it('0001_baseline on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0001_baseline');
  });

  it('schema_migrations tabel on olemas', async () => {
    const { rows } = await pool.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS ok");
    expect(rows[0].ok).toBe(true);
  });

  // Need kaks piirangut olid varem AINULT db/init.sql-is ja PUUDUSID
  // `ensureSchema()`-st ehitatud testibaasist. Migratsioonidele üleminek
  // teeb testiskeemi rangemaks kui varem — täpselt see oli Slice 1b eesmärk.
  it('price_snapshots UNIQUE (company_id, captured_at) on olemas', async () => {
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('price_snapshots') AND contype = 'u'
          AND pg_get_constraintdef(oid) ILIKE '%(company_id, captured_at)%'
      ) AS ok`);
    expect(rows[0].ok).toBe(true);
  });

  it('investment_theses status CHECK on olemas', async () => {
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('investment_theses') AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
      ) AS ok`);
    expect(rows[0].ok).toBe(true);
  });

  it('UNIQUE piirang tõesti jõustub — duplikaat-hinnasnapshot lükatakse tagasi', async () => {
    const { rows } = await pool.query(`INSERT INTO companies (ticker) VALUES ('DUP') RETURNING id`);
    const companyId = Number(rows[0].id);
    const at = '2026-01-01T00:00:00.000Z';
    await pool.query(
      `INSERT INTO price_snapshots (company_id, price, captured_at, source) VALUES ($1, 1, $2, 'test')`,
      [companyId, at],
    );
    await expect(pool.query(
      `INSERT INTO price_snapshots (company_id, price, captured_at, source) VALUES ($1, 2, $2, 'test')`,
      [companyId, at],
    )).rejects.toThrow();
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
