import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { ensureSchema, pool } from '../../src/lib/db';
import { ensureFinancialSchema } from '../../src/lib/company-financials';
import { ensureResearchSchema } from '../../src/lib/company-research-store';
import { ensureScoreTrackingSchema } from '../../src/lib/score-tracking';
import { enrichCompanyClassifications } from '../../src/lib/company-classification';
import { TEST_DB_NAME } from '../setup/test-db-url';
import { publicTables, resetDb } from '../setup/reset';
import { addedItems, removedItems, schemaSnapshot } from '../setup/schema-snapshot';

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
  'collection_run_items',
  'collection_runs',
  'companies',
  'company_score_snapshots',
  'data_quality_snapshots',
  'discovery_decisions',
  'discovery_runs',
  'earnings_events',
  'financial_enrichment_status',
  'financial_facts',
  'insider_filings',
  'insider_reporting_owners',
  'insider_transaction_footnotes',
  'insider_transactions',
  'investment_theses',
  'news_items',
  'outcome_analysis_snapshots',
  'paper_capital_accounts',
  'paper_capital_entry_policies',
  'paper_capital_runs',
  'paper_capital_trades',
  'paper_strategy_marks',
  'paper_strategy_orders',
  'portfolio_positions',
  'price_snapshots',
  'price_tracking_attempts',
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
  it('loob täpselt versioonitud migratsioonide tabelikomplekti', () => {
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

  it('0002_collection_runs_ledger on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0002_collection_runs_ledger');
  });

  it('0003_data_quality_snapshots on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0003_data_quality_snapshots');
    expect(inject('migratedTables')).toContain('data_quality_snapshots');
  });

  it('0004_collection_run_items on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0004_collection_run_items');
    expect(inject('migratedTables')).toContain('collection_run_items');
  });

  it('0005_outcome_analysis_snapshots on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0005_outcome_analysis_snapshots');
    expect(inject('migratedTables')).toContain('outcome_analysis_snapshots');
  });

  it('0006_insider_form4_persistence on rakendatud', () => {
    expect(inject('appliedMigrations')).toContain('0006_insider_form4_persistence');
    expect(inject('migratedTables')).toContain('insider_filings');
    expect(inject('migratedTables')).toContain('insider_reporting_owners');
    expect(inject('migratedTables')).toContain('insider_transactions');
    expect(inject('migratedTables')).toContain('insider_transaction_footnotes');
  });

  it('0007_insider_lookup_bucket on rakendatud', async () => {
    expect(inject('appliedMigrations')).toContain('0007_insider_lookup_bucket');
    const column = await pool.query(`SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'collection_run_items' AND column_name = 'insider_rank'`);
    expect(column.rows[0]).toEqual({ is_nullable: 'YES' });
    const constraints = await pool.query(`SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conname IN (
        'collection_run_items_bucket_check', 'outcome_analysis_snapshots_bucket_check'
      ) ORDER BY conname`);
    expect(constraints.rows).toHaveLength(2);
    expect(constraints.rows.every((row) => String(row.definition).includes("'insider'"))).toBe(true);
  });

  it('0008_paper_strategy on rakendatud ilma brokeri või discovery skeemi muutmata', () => {
    expect(inject('appliedMigrations')).toContain('0008_paper_strategy');
    expect(inject('migratedTables')).toContain('paper_strategy_orders');
    expect(inject('migratedTables')).toContain('paper_strategy_marks');
  });

  it('0010_thesis_valuation_review lisab versioonitud valuation-väljad ja hinnaviite', async () => {
    expect(inject('appliedMigrations')).toContain('0010_thesis_valuation_review');
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'investment_theses'
        AND column_name IN (
          'revenue_assumption', 'margin_assumption', 'cash_flow_assumption',
          'dilution_assumption', 'valuation_assumption', 'downside_scenario',
          'reverse_valuation_question', 'next_review_trigger', 'valuation_price_snapshot_id'
        ) ORDER BY column_name`);
    expect(columns.rows.map((row) => row.column_name)).toHaveLength(9);

    const constraint = await pool.query(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = to_regclass('investment_theses')
        AND conname = 'investment_theses_valuation_price_snapshot_id_fkey'`);
    expect(constraint.rows[0]?.definition).toContain('FOREIGN KEY (valuation_price_snapshot_id)');
    expect(constraint.rows[0]?.definition).toContain('REFERENCES price_snapshots(id) ON DELETE RESTRICT');
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

describe('D5 — runtime schema ensure funktsioonid on migratsioonide järel no-op', () => {
  // TOP 9 Slice 2. Testibaas ehitatakse `db/migrations/*.sql`-ist. Kui baseline
  // katab kogu runtime DDL-i, EI TOHI ükski `ensure*` kutse skeemi muuta.
  //
  // Miks see test on oluline:
  //   1. Tõestab empiiriliselt, et runtime DDL on migreeritud skeemil üleliigne.
  //      See on eeltingimus, et `src/` alt üldse tohiks midagi eemaldada.
  //   2. Toimib DRIFTI VALVENA: kui keegi lisab `ensureSchema()`-sse veeru ilma
  //      vastava migratsioonita, läheb see test kohe punaseks.
  //
  // Parandus ebaõnnestumise korral käib ALATI baseline/migratsiooni poolelt —
  // mitte `ensure*` funktsiooni eemaldades.
  //
  // NB memoiseerimise kohta: `ensureSchema()` (db.ts) EI ole memoiseeritud ja
  // jookseb iga kutse peale täies mahus (20 CREATE TABLE + 58 ADD COLUMN +
  // 12 CREATE INDEX). Ülejäänud neli hoiavad mooduli tasemel promise-cache'i,
  // seega nende SQL käivitub selles protsessis ESIMESEL kutsel — mis siin ka
  // toimub, sest ükski varasem test selles failis neid ei kutsu.

  // `enrichCompanyClassifications` on ainus eksporditud tee
  // `ensureClassificationColumns()`-ini. Tühja `companies` tabeliga on järjekord
  // tühi ega tehta ühtki võrgupäringut; stub tõestab seda valjult.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function callAllEnsureFunctions(): Promise<void> {
    await ensureSchema();
    await ensureFinancialSchema();
    await ensureResearchSchema();
    await ensureScoreTrackingSchema();
    await enrichCompanyClassifications(1);
  }

  it('ei lisa ega eemalda ühtegi tabelit, veergu, indeksit ega piirangut', async () => {
    vi.stubGlobal('fetch', async (input: unknown) => {
      throw new Error(`D5 ei tohi võrku puutuda, aga püüti: ${String(input)}`);
    });

    const before = await schemaSnapshot();
    await callAllEnsureFunctions();
    const after = await schemaSnapshot();

    // Iga liik eraldi, et ebaõnnestumise teade nimetaks TÄPSE objekti.
    expect(addedItems(before.tables, after.tables)).toEqual([]);
    expect(addedItems(before.columns, after.columns)).toEqual([]);
    expect(addedItems(before.indexes, after.indexes)).toEqual([]);
    expect(addedItems(before.constraints, after.constraints)).toEqual([]);

    // Runtime DDL on ainult IF NOT EXISTS kujul, seega ei tohi ka midagi kaduda.
    expect(removedItems(before.tables, after.tables)).toEqual([]);
    expect(removedItems(before.columns, after.columns)).toEqual([]);
    expect(removedItems(before.indexes, after.indexes)).toEqual([]);
    expect(removedItems(before.constraints, after.constraints)).toEqual([]);

    expect(after).toEqual(before);
  });

  it('on stabiilne ka korduval kutsel (ensureSchema ei ole memoiseeritud)', async () => {
    vi.stubGlobal('fetch', async (input: unknown) => {
      throw new Error(`D5 ei tohi võrku puutuda, aga püüti: ${String(input)}`);
    });

    await callAllEnsureFunctions();
    const before = await schemaSnapshot();
    await callAllEnsureFunctions();
    const after = await schemaSnapshot();

    expect(after).toEqual(before);
  });

  it('snapshot ise on deterministlik ja mittetühi', async () => {
    const first = await schemaSnapshot();
    const second = await schemaSnapshot();

    expect(second).toEqual(first);
    // Kaitse sisutühja testi vastu: kui tõmmis oleks tühi, läbiks võrdlus
    // triviaalselt ega tõestaks midagi.
    expect(first.tables.length).toBeGreaterThan(20);
    expect(first.columns.length).toBeGreaterThan(250);
    expect(first.constraints.length).toBeGreaterThan(50);
  });
});
