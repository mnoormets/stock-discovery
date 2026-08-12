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
// Skeem tuleb src/lib/db.ts `ensureSchema()`-st, mis on tootmise tegelik
// skeemi-tõeallikas. db/init.sql-i teadlikult EI kasutata: see on teine,
// osaliselt dubleeriv allikas.

async function maintenance(sql: string): Promise<void> {
  const client = new Client({ connectionString: MAINTENANCE_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export default async function setup() {
  assertTestDatabaseName();

  // Värske baas iga jooksu alguses, et eelmise jooksu jäägid ei mõjutaks
  // tulemust. WITH (FORCE) katkestab rippuvad ühendused (PostgreSQL 13+;
  // klaster on 16).
  await maintenance(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  await maintenance(`CREATE DATABASE "${TEST_DB_NAME}"`);

  // DATABASE_URL peab olema seatud ENNE src/lib/db.ts importi, sest see loob
  // Pool'i impordi hetkel. Dünaamiline import hoiab järjekorra kindlana.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { ensureSchema, pool } = await import('../../src/lib/db');
  try {
    await ensureSchema();
    const { rows } = await pool.query('SELECT current_database() AS db');
    if (String(rows[0].db) !== TEST_DB_NAME) {
      throw new Error(`globalSetup ühendus vale andmebaasiga: ${String(rows[0].db)}`);
    }
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
