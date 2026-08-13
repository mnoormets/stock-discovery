// Minimaalne KÄSITSI käivitatav migration runner.
//
// Kasutus:
//   npm run migrate -- --status                 # ainult raport, ei kirjuta midagi
//   npm run migrate                             # rakendab rakendamata migratsioonid
//   npm run migrate -- --database-url <url>     # eksplitsiitne sihtbaas
//   npm run migrate -- --allow-discovery        # lubab "discovery" baasi (VAIKIMISI KEELATUD)
//
// Ohutuspõhimõtted:
//   * Midagi ei käivitu automaatselt — app startup ja testid seda ei kutsu.
//   * Vaikimisi KEELDUB baasist nimega "discovery" (tootmine/dev golden source).
//   * Iga migratsioon jookseb ÜHES transaktsioonis koos oma schema_migrations
//     kirjega — pooleldi rakendatud olekut ei saa tekkida.
//   * Advisory lock hoiab ära kaks samaaegset migratorit.
//   * Checksum kaitseb tagantjärele muudetud migratsiooni eest.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { loadEnv, ensureLocalDatabaseUrl, repoRoot } = require('./_ts-loader.cjs');

const root = repoRoot();
loadEnv(root);

const args = process.argv.slice(2);
const STATUS_ONLY = args.includes('--status');
const ALLOW_DISCOVERY = args.includes('--allow-discovery');
const urlFlagIndex = args.indexOf('--database-url');
const urlOverride = urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : null;

const TARGET_URL = urlOverride || ensureLocalDatabaseUrl();
const MIGRATIONS_DIR = path.join(root, 'db', 'migrations');
const LOCK_NAME = 'stock-discovery:migrate';
const PROTECTED_DATABASE = 'discovery';

function redact(url) { return url.replace(/\/\/[^@]*@/, '//***@'); }
function checksum(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

// Loeb migratsioonid leksikograafilises järjekorras. Mitte-.sql failid
// (nt README.md) jäetakse vahele.
function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
      return { version: name.replace(/\.sql$/i, ''), file: name, sql, checksum: checksum(sql) };
    });
}

// Transaktsiooni omab RUNNER. Kui fail sisaldaks oma BEGIN/COMMIT-i, läheks
// schema_migrations kirje väljapoole migratsiooni transaktsiooni ja atomaarsus
// kaoks. Seetõttu keeldume sellisest failist.
function assertNoExplicitTransaction(migration) {
  const naked = migration.sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (/\b(BEGIN|COMMIT|ROLLBACK)\s*;/i.test(naked)) {
    throw new Error(
      `${migration.file}: fail sisaldab oma BEGIN/COMMIT/ROLLBACK-i. `
      + 'Transaktsiooni omab runner — eemalda need failist.',
    );
  }
}

async function ensureBookkeeping(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version       TEXT PRIMARY KEY,
      applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum      TEXT NOT NULL,
      execution_ms  INTEGER
    )`);
}

async function readApplied(client) {
  const exists = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS ok");
  if (!exists.rows[0].ok) return null; // tabelit pole -> kõik on pending
  const { rows } = await client.query(
    'SELECT version, checksum, applied_at, execution_ms FROM schema_migrations ORDER BY version',
  );
  return new Map(rows.map((r) => [r.version, r]));
}

function assertDatabaseAllowed(dbName) {
  if (dbName === PROTECTED_DATABASE && !ALLOW_DISCOVERY) {
    throw new Error(
      `KEELATUD: sihtbaas on "${dbName}". Migratsioone ei rakendata kaitstud baasi vastu ilma `
      + '--allow-discovery liputa. Testimiseks kasuta ajutist baasi (nt *_migration_tmp).',
    );
  }
}

async function runStatus(client, migrations, dbName) {
  const applied = await readApplied(client);
  console.log(`\n  andmebaas: ${dbName}`);
  console.log(`  schema_migrations: ${applied === null ? 'PUUDUB (kõik on pending)' : `olemas, ${applied.size} kirjet`}`);
  console.log(`\n  ${'versioon'.padEnd(26)} ${'seis'.padEnd(18)} detail`);
  console.log(`  ${'-'.repeat(70)}`);
  let pending = 0;
  for (const migration of migrations) {
    const row = applied?.get(migration.version);
    let state; let detail = '';
    if (!row) { state = 'PENDING'; pending += 1; }
    else if (row.checksum !== migration.checksum) {
      state = 'CHECKSUM MISMATCH';
      detail = `salvestatud ${row.checksum.slice(0, 12)}… vs fail ${migration.checksum.slice(0, 12)}…`;
    } else {
      state = 'applied';
      detail = `${new Date(row.applied_at).toISOString().slice(0, 19)}Z · ${row.execution_ms ?? '?'} ms`;
    }
    console.log(`  ${migration.version.padEnd(26)} ${state.padEnd(18)} ${detail}`);
  }
  console.log(`\n  kokku ${migrations.length} migratsiooni, ${pending} rakendamata`);
  console.log('  (--status ei kirjuta midagi ega loo schema_migrations tabelit)');
}

async function runMigrations(client, migrations) {
  const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
  if (lock.rows[0].ok !== true) {
    console.log('\n  TEINE MIGRATOR JOOKSEB JUBA (advisory lock on võetud). Katkestan puhtalt.');
    return 0;
  }
  try {
    await ensureBookkeeping(client);
    const applied = (await readApplied(client)) ?? new Map();
    let appliedNow = 0;
    let skipped = 0;

    for (const migration of migrations) {
      const row = applied.get(migration.version);

      if (row && row.checksum === migration.checksum) {
        console.log(`  SKIP     ${migration.version} (juba rakendatud, checksum klapib)`);
        skipped += 1;
        continue;
      }

      if (row && row.checksum !== migration.checksum) {
        // Tagantjärele muudetud migratsioon. EI paranda automaatselt ega jätka:
        // järgnevad migratsioonid võivad sellest sõltuda.
        throw new Error(
          `CHECKSUM MISMATCH: ${migration.file} on pärast rakendamist muudetud.\n`
          + `    salvestatud: ${row.checksum}\n`
          + `    faili oma  : ${migration.checksum}\n`
          + '    Rakendatud migratsiooni ei tohi muuta. Paranda UUE migratsiooniga.',
        );
      }

      assertNoExplicitTransaction(migration);
      process.stdout.write(`  APPLY    ${migration.version} ... `);
      const started = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        const ms = Date.now() - started;
        await client.query(
          'INSERT INTO schema_migrations (version, checksum, execution_ms) VALUES ($1, $2, $3)',
          [migration.version, migration.checksum, ms],
        );
        await client.query('COMMIT');
        console.log(`OK (${ms} ms)`);
        appliedNow += 1;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('EBAÕNNESTUS');
        throw new Error(`${migration.file} ebaõnnestus ja rulliti tagasi: ${error.message}`);
      }
    }
    console.log(`\n  rakendatud ${appliedNow}, vahele jäetud ${skipped}`);
    return appliedNow;
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
  }
}

(async () => {
  console.log('=== Stock Discovery · migrate ===');
  console.log(`  režiim: ${STATUS_ONLY ? '--status (ei kirjuta midagi)' : 'rakendamine'}`);
  console.log(`  DB: ${redact(TARGET_URL)}`);

  const migrations = readMigrations();
  if (migrations.length === 0) {
    console.log('\n  db/migrations/ ei sisalda ühtki .sql faili.');
    return;
  }

  const client = new Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT current_database() AS db');
    const dbName = String(rows[0].db);

    if (STATUS_ONLY) {
      await runStatus(client, migrations, dbName);
      return;
    }

    // Kaitse rakendub ALLES siin: --status tohib ka kaitstud baasi vaadata.
    assertDatabaseAllowed(dbName);
    console.log(`  sihtbaas: ${dbName}\n`);
    await runMigrations(client, migrations);
  } finally {
    await client.end().catch(() => {});
  }
})()
  .then(() => { console.log(''); process.exit(0); })
  .catch((error) => { console.error(`\nmigrate ebaõnnestus: ${error.message}\n`); process.exit(1); });
