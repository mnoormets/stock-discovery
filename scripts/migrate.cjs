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

// M1: konservatiivsed timeoutid AINULT migratsiooni ühendusel.
// lock_timeout on lühike — kui app hoiab tabelil lukku, katkeb migratsioon
// kiiresti ja loetavalt, mitte ei ripu. statement_timeout on pikem, sest
// suur CREATE INDEX võib legitiimselt kesta.
const LOCK_TIMEOUT = '10s';
const STATEMENT_TIMEOUT = '5min';

// Exit-koodid (dokumenteeritud db/migrations/README.md-s).
const EXIT = {
  OK: 0,        // õnnestus / GO
  ERROR: 1,     // viga: checksum mismatch, guard, ebaõnnestunud migratsioon
  NO_GO: 2,     // --preflight / --conformance leidis blokeerija
  LOCK_BUSY: 3, // apply-režiim: teine migrator hoiab advisory lukku
};

// Ajutise conformance-DB nimi PEAB lõppema selle sufiksiga — dropTmp keeldub muidu.
const TMP_SUFFIX = '_diff_tmp';
const CONFORMANCE_TMP = `schema_conformance${TMP_SUFFIX}`;

function redact(url) { return url.replace(/\/\/[^@]*@/, '//***@'); }

// H2: checksum peab olema MASINATEÜLENE. Git `core.autocrlf=true` annab Windowsis
// CRLF-checkout'i ja Linuxis LF-i — sama fail annaks eri masinates eri räsi ja
// runner viskaks vale CHECKSUM MISMATCH vea. Normaliseerime reavahetused enne
// räsimist; muu sisu jääb baithaaval samaks. `.gitattributes` (*.sql eol=lf) on
// teine kaitsekiht, kuid runner EI TOHI sellest sõltuda.
function normalizeSql(text) { return text.replace(/\r\n/g, '\n'); }
function checksum(text) { return crypto.createHash('sha256').update(normalizeSql(text)).digest('hex'); }

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

// --- H3: conformance — kas sihtbaas VASTAB baseline sihtskeemile? ----------
//
// Ehitab ajutise DB baseline'ist ja võrdleb selle skeemi sihtbaasi omaga.
// Sihtbaasi suhtes TÄIELIKULT READ-ONLY. Ajutine DB kustutatakse alati.

const OBJECT_QUERIES = {
  tables: `SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY 1`,
  columns: `SELECT table_name||'.'||column_name AS name FROM information_schema.columns
            WHERE table_schema='public' ORDER BY 1`,
  indexes: `SELECT tablename||' :: '||regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX [a-z0-9_]+ ', 'IDX ') AS name
            FROM pg_indexes WHERE schemaname='public' ORDER BY 1`,
  constraints: `SELECT c.conrelid::regclass::text||' :: '||c.contype::text||' :: '||pg_get_constraintdef(c.oid) AS name
                FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                WHERE n.nspname='public' ORDER BY 1`,
};

function withDatabase(url, name) {
  const [base, query] = url.split('?');
  const afterScheme = base.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const slash = afterScheme.indexOf('/');
  if (slash === -1) throw new Error('DATABASE_URL ei sisalda andmebaasi teed.');
  return base.slice(0, base.length - afterScheme.length + slash + 1) + name + (query ? `?${query}` : '');
}

async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end().catch(() => {}); }
}

async function readObjects(client) {
  const out = {};
  for (const [kind, sql] of Object.entries(OBJECT_QUERIES)) {
    const { rows } = await client.query(sql);
    out[kind] = rows.map((r) => String(r.name));
  }
  return out;
}

async function dropTmp(maintenanceUrl, name) {
  if (!name.endsWith(TMP_SUFFIX)) {
    throw new Error(`KEELATUD: keeldun kustutamast andmebaasi "${name}" — nimi ei lõpe "${TMP_SUFFIX}".`);
  }
  await withClient(maintenanceUrl, (c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}

// Tagastab veergude hulga, mille baseline suudab OLEMASOLEVASSE tabelisse
// lisada (ADD COLUMN IF NOT EXISTS plokk). Ülejäänud puuduvad veerud vajavad
// käsitsi repair-migratsiooni — need teevad verdikti NO-GO.
function baselineRepairableColumns(migrations) {
  const repairable = new Set();
  for (const migration of migrations) {
    const re = /ALTER TABLE (\w+)\s+ADD COLUMN IF NOT EXISTS (\w+)/gi;
    let match;
    while ((match = re.exec(migration.sql)) !== null) {
      repairable.add(`${match[1]}.${match[2]}`);
    }
  }
  return repairable;
}

async function runConformance(targetUrl, targetClient, migrations, dbName, log) {
  log(`\n-- Conformance: sihtbaas vs baseline sihtskeem --`);
  log(`  sihtbaas: ${dbName} (read-only)`);
  log(`  ajutine referents: ${CONFORMANCE_TMP}`);

  const maintenanceUrl = withDatabase(targetUrl, 'postgres');
  const tmpUrl = withDatabase(targetUrl, CONFORMANCE_TMP);
  const repairable = baselineRepairableColumns(migrations);

  try {
    await dropTmp(maintenanceUrl, CONFORMANCE_TMP);
    await withClient(maintenanceUrl, (c) => c.query(`CREATE DATABASE "${CONFORMANCE_TMP}"`));
    await withClient(tmpUrl, async (c) => {
      for (const migration of migrations) await c.query(migration.sql);
    });

    const expected = await withClient(tmpUrl, readObjects);
    const actual = await readObjects(targetClient);

    const missing = {};
    const extra = {};
    for (const kind of Object.keys(OBJECT_QUERIES)) {
      const actualSet = new Set(actual[kind]);
      const expectedSet = new Set(expected[kind]);
      missing[kind] = expected[kind].filter((x) => !actualSet.has(x));
      extra[kind] = actual[kind].filter((x) => !expectedSet.has(x));
    }

    // Puuduv veerg OLEMASOLEVAS tabelis on H1 juhtum: CREATE TABLE IF NOT EXISTS
    // ei paranda seda. Eristame need, mida baseline suudab ADD COLUMN-iga lisada.
    const existingTables = new Set(actual.tables);
    const unrepairableColumns = missing.columns.filter((col) => {
      const table = col.split('.')[0];
      return existingTables.has(table) && !repairable.has(col);
    });

    for (const kind of Object.keys(OBJECT_QUERIES)) {
      const m = missing[kind];
      log(`  ${`puuduvaid ${kind}`.padEnd(34)} ${String(m.length).padStart(6)}`);
      for (const x of m.slice(0, 8)) log(`      - ${x}`);
      if (m.length > 8) log(`      ... veel ${m.length - 8}`);
    }
    const extraTotal = Object.values(extra).reduce((sum, list) => sum + list.length, 0);
    log(`  ${'sihtbaasis ÜLE (baseline ei kirjelda)'.padEnd(34)} ${String(extraTotal).padStart(6)}`);
    for (const kind of Object.keys(OBJECT_QUERIES)) {
      for (const x of extra[kind].slice(0, 4)) log(`      + ${x}`);
    }

    const blockers = [];
    if (unrepairableColumns.length > 0) {
      blockers.push(
        `${unrepairableColumns.length} puuduvat veergu OLEMASOLEVAS tabelis, mida baseline EI paranda `
        + `(nt ${unrepairableColumns.slice(0, 3).join(', ')}). Vajab eraldi repair-migratsiooni.`,
      );
    }

    const totalMissing = Object.values(missing).reduce((sum, list) => sum + list.length, 0);
    return { missing, extra, unrepairableColumns, blockers, totalMissing, conformant: totalMissing === 0 };
  } finally {
    await dropTmp(maintenanceUrl, CONFORMANCE_TMP)
      .catch((e) => log(`  koristus ebaõnnestus: ${e.message}`));
  }
}

// Ühtne GO / NO-GO vaade ENNE production apply't. TÄIELIKULT READ-ONLY:
// ei loo schema_migrations tabelit ega puuduta andmeid. Koondab ühte kohta
// selle, mis muidu on jagatud `migrate --status` ja `schema:diff` vahel.
async function runPreflight(client, migrations, dbName, log, targetUrl) {
  const blockers = [];
  const notes = [];

  log(`\n-- 1. Sihtandmebaas --`);
  const isProtected = dbName === PROTECTED_DATABASE;
  log(`  ${'andmebaas'.padEnd(34)} ${dbName}`);
  log(`  ${'kaitstud baas?'.padEnd(34)} ${isProtected ? 'JAH' : 'ei'}`
    + (isProtected ? '   <-- apply NÕUAB --allow-discovery lippu' : ''));
  if (isProtected) notes.push('Apply nõuab eksplitsiitset --allow-discovery lippu.');

  log(`\n-- 2. Migratsioonide seis --`);
  const applied = await readApplied(client);
  log(`  ${'schema_migrations'.padEnd(34)} ${applied === null ? 'PUUDUB (kõik on pending)' : `olemas, ${applied.size} kirjet`}`);
  let pending = 0;
  for (const migration of migrations) {
    const row = applied?.get(migration.version);
    let state;
    if (!row) { state = 'PENDING'; pending += 1; }
    else if (row.checksum !== migration.checksum) {
      state = 'CHECKSUM MISMATCH';
      blockers.push(`${migration.file}: checksum ei klapi — fail on pärast rakendamist muudetud.`);
    } else state = 'applied';
    log(`  ${migration.version.padEnd(34)} ${state}`);
  }

  log(`\n-- 3. Andmekontroll (piirangute eeldused) --`);
  const tableExists = async (table) => {
    const { rows } = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
    return rows[0].ok;
  };

  if (await tableExists('price_snapshots')) {
    const { rows } = await client.query(`
      SELECT count(*)::int AS n FROM (
        SELECT 1 FROM price_snapshots GROUP BY company_id, captured_at HAVING count(*) > 1
      ) dup`);
    const n = rows[0].n;
    log(`  ${'price_snapshots duplikaate'.padEnd(34)} ${String(n).padStart(6)}   ${n === 0 ? 'OK — UNIQUE saab lisada' : 'BLOKEERIB'}`);
    if (n > 0) blockers.push(`price_snapshots: ${n} duplikaatpaari — UNIQUE piirang ebaõnnestuks.`);
  } else {
    log(`  ${'price_snapshots duplikaate'.padEnd(34)} ${'-'.padStart(6)}   tabel puudub (uus baas)`);
  }

  if (await tableExists('investment_theses')) {
    const { rows } = await client.query(`
      SELECT count(*)::int AS n FROM investment_theses
      WHERE status IS NULL OR status NOT IN ('draft','researching','ready','rejected')`);
    const n = rows[0].n;
    log(`  ${'investment_theses vigaseid'.padEnd(34)} ${String(n).padStart(6)}   ${n === 0 ? 'OK — CHECK saab lisada' : 'BLOKEERIB'}`);
    if (n > 0) blockers.push(`investment_theses: ${n} vigast staatust — CHECK piirang ebaõnnestuks.`);
  } else {
    log(`  ${'investment_theses vigaseid'.padEnd(34)} ${'-'.padStart(6)}   tabel puudub (uus baas)`);
  }

  // H1/H3: conformance ütleb, kas baseline üldse VIIB sihtbaasi sihtskeemi.
  log(`\n-- 4. Conformance (kas baseline viib sihtskeemi?) --`);
  const conformance = await runConformance(targetUrl, client, migrations, dbName, (m) => log(`  ${m.trim() ? m : ''}`));
  blockers.push(...conformance.blockers);
  if (conformance.conformant) {
    notes.push('Sihtbaas vastab juba baseline sihtskeemile.');
  } else if (conformance.blockers.length === 0) {
    notes.push(`${conformance.totalMissing} puuduvat objekti — baseline suudab need lisada.`);
  }

  log(`\n-- 5. VERDIKT --`);
  if (blockers.length > 0) {
    log('  NO-GO — lahenda enne apply\'d:');
    for (const b of blockers) log(`    ! ${b}`);
  } else if (pending === 0) {
    log('  GO (tegevust pole) — kõik migratsioonid on juba rakendatud.');
  } else {
    log(`  GO — ${pending} migratsiooni on rakendamiseks valmis.`);
    for (const n of notes) log(`    NB: ${n}`);
  }
  log('  (--preflight on read-only: ei loo schema_migrations tabelit ega muuda andmeid)');

  return { applied: 0, skipped: 0, pending, blockers, go: blockers.length === 0 };
}

async function applyMigrations(client, migrations, log) {
  const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
  if (lock.rows[0].ok !== true) {
    // M2: apply-režiimis EI TOHI "midagi ei tehtud" näida õnnestunud migratsioonina.
    // Skriptitud kasutus peab siin katkema, seega viskame vea (exit 3).
    const error = new Error(
      'TEINE MIGRATOR JOOKSEB JUBA (advisory lock on võetud). Ühtki migratsiooni ei rakendatud.',
    );
    error.exitCode = EXIT.LOCK_BUSY;
    throw error;
  }
  try {
    // M1: DDL võtab ACCESS EXCLUSIVE lukud. Ilma timeoutita võib migratsioon
    // rippuda lõpmatuseni app'i lahtise ühenduse taga, hoides samal ajal
    // advisory lukku. Timeoutid kehtivad AINULT sellel ühendusel (SET, mitte
    // ALTER DATABASE) ja ainult apply-teel; --status/--preflight ei vaja neid.
    await client.query(`SET lock_timeout = '${LOCK_TIMEOUT}'`);
    await client.query(`SET statement_timeout = '${STATEMENT_TIMEOUT}'`);
    log(`  timeoutid: lock_timeout=${LOCK_TIMEOUT}, statement_timeout=${STATEMENT_TIMEOUT}`);
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
 * @param {boolean} [options.preflight]    GO/NO-GO kontroll, ei kirjuta midagi
 * @param {boolean} [options.conformanceOnly] ainult conformance (siht vs baseline)
 * @param {(msg: string) => void} [options.log]
 */
async function runMigrations(options = {}) {
  const {
    databaseUrl,
    allowDiscovery = false,
    statusOnly = false,
    preflight = false,
    conformanceOnly = false,
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

    if (conformanceOnly) {
      const result = await runConformance(target, client, migrations, dbName, log);
      log(`\n  VERDIKT: ${result.blockers.length > 0 ? 'NO-GO' : result.conformant ? 'VASTAB' : 'ERINEB (baseline suudab parandada)'}`);
      for (const b of result.blockers) log(`    ! ${b}`);
      return { ...result, go: result.blockers.length === 0, migrations, databaseName: dbName };
    }

    if (preflight) {
      const result = await runPreflight(client, migrations, dbName, log, target);
      return { ...result, migrations, databaseName: dbName };
    }

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
  const preflight = args.includes('--preflight');
  const conformanceOnly = args.includes('--conformance');
  const allowDiscovery = args.includes('--allow-discovery');
  const urlFlagIndex = args.indexOf('--database-url');
  const databaseUrl = urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : undefined;

  const mode = conformanceOnly ? '--conformance (siht vs baseline, read-only)'
    : preflight ? '--preflight (GO/NO-GO, ei kirjuta midagi)'
      : statusOnly ? '--status (ei kirjuta midagi)'
        : 'rakendamine';

  console.log('=== Stock Discovery · migrate ===');
  console.log(`  režiim: ${mode}`);
  console.log(`  DB: ${redact(databaseUrl || ensureLocalDatabaseUrl())}`);

  runMigrations({ databaseUrl, allowDiscovery, statusOnly, preflight, conformanceOnly })
    .then((result) => {
      const readOnlyMode = statusOnly || preflight || conformanceOnly;
      if (!readOnlyMode && result.databaseName) console.log(`  sihtbaas: ${result.databaseName}`);
      console.log('');
      // NO-GO annab mitte-nulli, et skriptitav kasutus saaks katkeda.
      process.exit((preflight || conformanceOnly) && result.go === false ? EXIT.NO_GO : EXIT.OK);
    })
    .catch((error) => {
      console.error(`\nmigrate ebaõnnestus: ${error.message}\n`);
      process.exit(error.exitCode || EXIT.ERROR);
    });
}
