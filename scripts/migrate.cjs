// Minimaalne KÄSITSI käivitatav migration runner.
//
// Kasutus CLI-na:
//   npm run migrate -- --status                 # ainult raport, ei kirjuta midagi
//   npm run migrate                             # rakendab rakendamata migratsioonid
//   npm run migrate -- --database-url <url>     # eksplitsiitne sihtbaas
//   npm run migrate -- --allow-discovery        # lubab "discovery" baasi (VAIKIMISI KEELATUD)
//
// Kasutus moodulina (nt tests/setup/global-setup.ts):
//   const { runMigrations } = require('./scripts/migrate.cjs');
//   await runMigrations({ databaseUrl, log });
//
// Ohutuspõhimõtted:
//   * Midagi ei käivitu automaatselt — app startup seda ei kutsu.
//   * Vaikimisi KEELDUB baasist nimega "discovery" (dev / golden source).
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

// Transaktsiooni omab RUNNER. Kui fail sisaldaks oma BEGIN/COMMIT-i, satuks
// schema_migrations kirje migratsiooni transaktsioonist välja ja atomaarsus
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

function assertDatabaseAllowed(dbName, allowDiscovery) {
  if (dbName === PROTECTED_DATABASE && !allowDiscovery) {
    throw new Error(
      `KEELATUD: sihtbaas on "${dbName}". Migratsioone ei rakendata kaitstud baasi vastu ilma `
      + '--allow-discovery liputa. Testimiseks kasuta ajutist baasi (nt *_migration_tmp).',
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

async function reportStatus(client, migrations, dbName, log) {
  const applied = await readApplied(client);
  log(`\n  andmebaas: ${dbName}`);
  log(`  schema_migrations: ${applied === null ? 'PUUDUB (kõik on pending)' : `olemas, ${applied.size} kirjet`}`);
  log(`\n  ${'versioon'.padEnd(26)} ${'seis'.padEnd(18)} detail`);
  log(`  ${'-'.repeat(70)}`);
  let pending = 0;
  const states = [];
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
    states.push({ version: migration.version, state });
    log(`  ${migration.version.padEnd(26)} ${state.padEnd(18)} ${detail}`);
  }
  log(`\n  kokku ${migrations.length} migratsiooni, ${pending} rakendamata`);
  log('  (--status ei kirjuta midagi ega loo schema_migrations tabelit)');
  return { applied: 0, skipped: 0, pending, states };
}

async function applyMigrations(client, migrations, log) {
  const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
  if (lock.rows[0].ok !== true) {
    log('\n  TEINE MIGRATOR JOOKSEB JUBA (advisory lock on võetud). Katkestan puhtalt.');
    return { applied: 0, skipped: 0, locked: false };
  }
  try {
    await ensureBookkeeping(client);
    const applied = (await readApplied(client)) ?? new Map();
    let appliedNow = 0;
    let skipped = 0;

    for (const migration of migrations) {
      const row = applied.get(migration.version);

      if (row && row.checksum === migration.checksum) {
        log(`  SKIP     ${migration.version} (juba rakendatud, checksum klapib)`);
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
        log(`  APPLY    ${migration.version} ... OK (${ms} ms)`);
        appliedNow += 1;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        log(`  APPLY    ${migration.version} ... EBAÕNNESTUS`);
        throw new Error(`${migration.file} ebaõnnestus ja rulliti tagasi: ${error.message}`);
      }
    }
    log(`\n  rakendatud ${appliedNow}, vahele jäetud ${skipped}`);
    return { applied: appliedNow, skipped, locked: true };
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
  }
}

/**
 * Rakendab migratsioonid ühe sihtbaasi vastu. Kasutatav nii CLI-st kui
 * test-setupist. Ühendus avatakse ja suletakse siin.
 *
 * @param {object} options
 * @param {string} [options.databaseUrl]   sihtbaas; muidu DATABASE_URL / lokaalne vaikeväärtus
 * @param {boolean} [options.allowDiscovery] luba kaitstud "discovery" baas
 * @param {boolean} [options.statusOnly]   ainult raport, ei kirjuta midagi
 * @param {(msg: string) => void} [options.log]
 */
async function runMigrations(options = {}) {
  const {
    databaseUrl,
    allowDiscovery = false,
    statusOnly = false,
    log = console.log,
  } = options;

  const target = databaseUrl || ensureLocalDatabaseUrl();
  const migrations = readMigrations();
  if (migrations.length === 0) {
    log('\n  db/migrations/ ei sisalda ühtki .sql faili.');
    return { applied: 0, skipped: 0, migrations: [], databaseName: null };
  }

  const client = new Client({ connectionString: target });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT current_database() AS db');
    const dbName = String(rows[0].db);

    if (statusOnly) {
      const result = await reportStatus(client, migrations, dbName, log);
      return { ...result, migrations, databaseName: dbName };
    }

    // Kaitse rakendub ALLES siin: --status tohib ka kaitstud baasi vaadata.
    assertDatabaseAllowed(dbName, allowDiscovery);
    const result = await applyMigrations(client, migrations, log);
    return { ...result, migrations, databaseName: dbName };
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { runMigrations, readMigrations, checksum, MIGRATIONS_DIR };

// --- CLI ------------------------------------------------------------------
// Jookseb AINULT otsekäivitusel; moodulina importimine ei käivita midagi.
if (require.main === module) {
  loadEnv(root);

  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status');
  const allowDiscovery = args.includes('--allow-discovery');
  const urlFlagIndex = args.indexOf('--database-url');
  const databaseUrl = urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : undefined;

  console.log('=== Stock Discovery · migrate ===');
  console.log(`  režiim: ${statusOnly ? '--status (ei kirjuta midagi)' : 'rakendamine'}`);
  console.log(`  DB: ${redact(databaseUrl || ensureLocalDatabaseUrl())}`);

  runMigrations({ databaseUrl, allowDiscovery, statusOnly })
    .then((result) => {
      if (!statusOnly && result.databaseName) console.log(`  sihtbaas: ${result.databaseName}`);
      console.log('');
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\nmigrate ebaõnnestus: ${error.message}\n`);
      process.exit(1);
    });
}
