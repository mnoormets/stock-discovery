import { Client } from 'pg';
import {
  MAINTENANCE_DATABASE_URL,
  TEST_DATABASE_URL,
  TEST_DB_NAME,
  assertTestDatabaseName,
  redact,
} from './test-db-url';

// Vitest globalSetup: jookseb ÜKS kord enne kõiki testifaile ja enne seda, kui
// ükski worker käivitub. Siin luuakse värske test-andmebaas ja rakendatakse
// skeem. Teardown kustutab selle.
//
// Skeem tuleb VERSIOONITUD MIGRATSIOONIDEST (db/migrations/*.sql) läbi
// scripts/migrate.cjs runneri. Nii valideerib kogu olemasolev testikomplekt
// ühtlasi runnerit, baseline'i ja schema_migrations raamatupidamist.
// `ensureSchema()` jääb tootmises esialgu alles; db/init.sql-i ei kasutata.

async function maintenance(sql: string): Promise<void> {
  const client = new Client({ connectionString: MAINTENANCE_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

// `ensureSchema()` tabelikomplekt fikseeritakse SIIN, värskes baasis ja enne
// ühtki testi. Hilisem kood võib tabeleid lisada — nt `ensureFinancialSchema()`
// loob `financial_enrichment_status` alles enrichment-koodi esimesel käivitusel —
// ja testibaas on failide vahel jagatud. Jooksva `pg_tables` vastu assertimine
// muudaks selle karakteriseeringu failijärjekorrast sõltuvaks.
declare module 'vitest' {
  export interface ProvidedContext {
    migratedTables: string[];
    appliedMigrations: string[];
  }
}

interface GlobalSetupContext {
  provide: <K extends 'migratedTables' | 'appliedMigrations'>(key: K, value: string[]) => void;
}

export default async function setup(context: GlobalSetupContext) {
  assertTestDatabaseName();

  // Värske baas iga jooksu alguses, et eelmise jooksu jäägid ei mõjutaks
  // tulemust. WITH (FORCE) katkestab rippuvad ühendused (PostgreSQL 13+;
  // klaster on 16).
  await maintenance(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  await maintenance(`CREATE DATABASE "${TEST_DB_NAME}"`);

  // Skeem tuleb VERSIOONITUD MIGRATSIOONIDEST (db/migrations/*.sql), mitte
  // `ensureSchema()`-st. Nii valideerivad kõik olemasolevad testid ühtlasi
  // migration runnerit, baseline'i ja `schema_migrations` raamatupidamist.
  // Tootmises jääb `ensureSchema()` esialgu alles — see on eraldi slice.
  //
  // `--allow-discovery` EI ole siin kasutusel: runneri enda kaitse peab
  // kaitstud baasi tagasi lükkama, kui URL peaks kunagi valesti osutama.
  const { runMigrations } = await import('../../scripts/migrate.cjs');
  const migrationResult = await runMigrations({
    databaseUrl: TEST_DATABASE_URL,
    log: () => {}, // vaikne: globalSetup väljund hoitakse ühel real
  });

  // DATABASE_URL peab olema seatud ENNE src/lib/db.ts importi, sest see loob
  // Pool'i impordi hetkel. Dünaamiline import hoiab järjekorra kindlana.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { pool } = await import('../../src/lib/db');
  try {
    const { rows } = await pool.query('SELECT current_database() AS db');
    const connected = String(rows[0].db);
    if (connected === 'discovery') {
      throw new Error('KEELATUD: globalSetup ühendus tootmisandmebaasiga "discovery".');
    }
    if (connected !== TEST_DB_NAME) {
      throw new Error(`globalSetup ühendus vale andmebaasiga: ${connected}`);
    }

    // Tõend, et skeem tuli päriselt migratsioonidest ja baseline rakendus.
    const applied = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    if (applied.rowCount === 0) {
      throw new Error('globalSetup: schema_migrations on tühi — migratsioonid ei rakendunud.');
    }

    const tables = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    context.provide('migratedTables', tables.rows.map((row) => String(row.tablename)));
    context.provide('appliedMigrations', applied.rows.map((row) => String(row.version)));
    console.log(
      `[test-db] skeem migratsioonidest: ${migrationResult.applied} rakendatud, `
      + `${applied.rowCount} kirjet schema_migrations-is`,
    );
  } finally {
    // Pool tuleb sulgeda, muidu DROP DATABASE teardownis ei õnnestu ja Vitest
    // ripub avatud handle'i tõttu.
    await pool.end();
  }

  console.log(`[test-db] valmis: ${redact(TEST_DATABASE_URL)}`);

  return async () => {
    if (process.env.KEEP_TEST_DB === '1') {
      console.log(`[test-db] KEEP_TEST_DB=1 — "${TEST_DB_NAME}" jäeti alles.`);
      return;
    }
    await maintenance(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  };
}
