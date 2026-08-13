// Skeemi audit. VAIKIMISI TÄIELIKULT READ-ONLY: teeb ainult SELECT-e
// sihtandmebaasi vastu ja loeb faile. Ei CREATE, ei ALTER, ei DROP.
//
// Kasutus:
//   npm run schema:diff                 # read-only audit + preflight + koodiaudit
//   npm run schema:diff -- --compare    # LISAKS struktuurne diff (loob 2 ajutist DB-d)
//
// `--compare` on ainus režiim, mis üldse midagi loob. Ka siis ei puudutata
// sihtandmebaasi: kogu võrdlus toimub kahes ajutises baasis, mille nimi lõpeb
// `_diff_tmp`-ga, ja need kustutatakse lõpus. Kustutamine on nimega valvatud —
// skript keeldub kustutamast andmebaasi, mille nimi seda mustrit ei järgi.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules,
} = require('./_ts-loader.cjs');

const root = repoRoot();
registerRepoModules(root);
loadEnv(root);

// Sihtandmebaas fikseeritakse ENNE mistahes DATABASE_URL ümberseadmist.
const TARGET_URL = ensureLocalDatabaseUrl();
const COMPARE = process.argv.includes('--compare');

// Nimed PEAVAD lõppema TMP_SUFFIX-iga — dropTmp() keeldub muidu kustutamast.
const TMP_SUFFIX = '_diff_tmp';
const INIT_TMP = `schema_init${TMP_SUFFIX}`;
const RUNTIME_TMP = `schema_runtime${TMP_SUFFIX}`;

function redact(url) { return url.replace(/\/\/[^@]*@/, '//***@'); }

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
  try { return await fn(client); } finally { await client.end(); }
}

function head(title) { console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`); }
function sub(title) { console.log(`\n-- ${title} --`); }
function row(label, value, note = '') {
  console.log(`  ${String(label).padEnd(44)} ${String(value).padStart(9)}${note ? '   ' + note : ''}`);
}
function mark(ok) { return ok ? 'OLEMAS' : 'PUUDUB'; }

// --- Objektide lugemine (ainult SELECT) ------------------------------------

const OBJECT_QUERIES = {
  tables: `SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY 1`,
  columns: `SELECT table_name||'.'||column_name AS name FROM information_schema.columns
            WHERE table_schema='public' ORDER BY 1`,
  indexes: `SELECT tablename||' :: '||indexdef AS name FROM pg_indexes
            WHERE schemaname='public' ORDER BY 1`,
  constraints: `SELECT c.conrelid::regclass::text||' :: '||c.contype::text||' :: '||pg_get_constraintdef(c.oid) AS name
                FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                WHERE n.nspname='public' ORDER BY 1`,
};

async function readObjects(client) {
  const out = {};
  for (const [kind, sql] of Object.entries(OBJECT_QUERIES)) {
    const { rows } = await client.query(sql);
    out[kind] = rows.map((r) => String(r.name));
  }
  return out;
}

// --- A. Sihtandmebaasi read-only kontroll ----------------------------------

async function inspectTarget() {
  head(`A. SIHTANDMEBAAS (read-only)  ${redact(TARGET_URL)}`);
  await withClient(TARGET_URL, async (client) => {
    const { rows } = await client.query(`
      SELECT
        current_database() AS db,
        (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
        to_regclass('public.financial_enrichment_status') IS NOT NULL AS has_enrichment_status,
        to_regclass('public.catalyst_events')             IS NOT NULL AS has_catalyst_events,
        to_regclass('public.catalyst_assessments')        IS NOT NULL AS has_catalyst_assessments,
        EXISTS (SELECT 1 FROM pg_constraint c
                WHERE c.conrelid = to_regclass('public.price_snapshots')
                  AND c.contype='u'
                  AND pg_get_constraintdef(c.oid) ILIKE '%(company_id, captured_at)%') AS price_unique,
        EXISTS (SELECT 1 FROM pg_constraint c
                WHERE c.conrelid = to_regclass('public.investment_theses')
                  AND c.contype='c'
                  AND pg_get_constraintdef(c.oid) ILIKE '%status%') AS thesis_check
    `);
    const m = rows[0];
    row('andmebaas', m.db);
    row('tabeleid public skeemis', m.tables);
    sub('Drifti võtmeobjektid');
    row('price_snapshots UNIQUE (company_id,captured_at)', mark(m.price_unique),
      m.price_unique ? '' : '<-- init.sql loob, runtime EI loo');
    row('investment_theses status CHECK', mark(m.thesis_check),
      m.thesis_check ? '' : '<-- init.sql loob, runtime EI loo');
    row('financial_enrichment_status tabel', mark(m.has_enrichment_status));
    row('catalyst_events tabel', mark(m.has_catalyst_events),
      m.has_catalyst_events ? '' : '<-- runtime loob, init.sql EI loo');
    row('catalyst_assessments tabel', mark(m.has_catalyst_assessments),
      m.has_catalyst_assessments ? '' : '<-- runtime loob, init.sql EI loo');
  });
}

// --- B. Preflight: ainult SELECT-id ----------------------------------------

async function preflight() {
  head('B. PREFLIGHT — kas piiranguid saab ohutult lisada (ainult SELECT)');
  await withClient(TARGET_URL, async (client) => {
    const exists = async (table) => {
      const { rows } = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
      return rows[0].ok;
    };

    sub('price_snapshots UNIQUE (company_id, captured_at) eeldus');
    if (!(await exists('price_snapshots'))) {
      row('tabel puudub', '-', 'kontrolli ei saa teha');
    } else {
      const { rows } = await client.query(`
        SELECT company_id, captured_at, count(*)::int AS n
        FROM price_snapshots GROUP BY company_id, captured_at
        HAVING count(*) > 1 ORDER BY n DESC LIMIT 10`);
      row('duplikaatpaare', rows.length, rows.length === 0 ? 'OK — UNIQUE saab lisada' : 'BLOKEERIB migratsiooni');
      for (const r of rows) console.log(`      company_id=${r.company_id} captured_at=${r.captured_at} x${r.n}`);
    }

    sub('investment_theses status CHECK eeldus');
    if (!(await exists('investment_theses'))) {
      row('tabel puudub', '-', 'kontrolli ei saa teha');
    } else {
      const { rows } = await client.query(`
        SELECT id, status FROM investment_theses
        WHERE status IS NULL OR status NOT IN ('draft','researching','ready','rejected')
        ORDER BY id LIMIT 10`);
      row('vigaseid staatuseid', rows.length, rows.length === 0 ? 'OK — CHECK saab lisada' : 'BLOKEERIB migratsiooni');
      for (const r of rows) console.log(`      id=${r.id} status=${JSON.stringify(r.status)}`);
    }
  });
}

// --- C. Koodiaudit: skeemi omanikud (ainult failid, DB-d ei puudutata) -----

const OWNER_FILES = [
  'db/init.sql',
  'src/lib/db.ts',
  'src/lib/company-financials.ts',
  'src/lib/company-research-store.ts',
  'src/lib/score-tracking.ts',
  'src/lib/company-classification.ts',
];

function codeAudit() {
  head('C. KOODIAUDIT — skeemi omanikud (failidest, DB-d ei puudutata)');
  const owners = new Map();
  for (const rel of OWNER_FILES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const created = [...text.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map((m) => m[1]);
    const altered = [...text.matchAll(/ALTER TABLE ([a-z_]+)/g)].map((m) => m[1]);
    const adds = (text.match(/ADD COLUMN IF NOT EXISTS/g) || []).length;
    row(rel, `${new Set(created).size} CREATE`, `${adds} ADD COLUMN`);
    for (const t of new Set([...created, ...altered])) {
      if (!owners.has(t)) owners.set(t, new Set());
      owners.get(t).add(rel);
    }
  }
  sub('Mitme omanikuga tabelid (skeemivõla tuum)');
  const shared = [...owners.entries()].filter(([, files]) => files.size > 1)
    .sort((a, b) => b[1].size - a[1].size);
  if (shared.length === 0) console.log('  (jagatud tabeleid ei leitud)');
  for (const [table, files] of shared) {
    console.log(`  ${table.padEnd(30)} ${files.size} omanikku: ${[...files].join(', ')}`);
  }
}

// --- D. Struktuurne diff kahe ajutise DB vahel (--compare) -----------------

function diffLists(a, b) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    onlyA: a.filter((x) => !setB.has(x)),
    onlyB: b.filter((x) => !setA.has(x)),
    shared: a.filter((x) => setB.has(x)).length,
  };
}

async function dropTmp(maintenanceUrl, name) {
  // Nimega valve: kustutame AINULT ajutisi diff-baase.
  if (!name.endsWith(TMP_SUFFIX)) {
    throw new Error(`KEELATUD: keeldun kustutamast andmebaasi "${name}" — nimi ei lõpe "${TMP_SUFFIX}".`);
  }
  await withClient(maintenanceUrl, (c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}

async function structuralDiff() {
  head('D. STRUKTUURNE DIFF — init.sql vs runtime (kaks AJUTIST andmebaasi)');
  console.log('  Sihtandmebaasi EI puudutata. Ajutised baasid:');
  console.log(`    ${INIT_TMP} · ${RUNTIME_TMP}`);

  const maintenanceUrl = withDatabase(TARGET_URL, 'postgres');
  const initUrl = withDatabase(TARGET_URL, INIT_TMP);
  const runtimeUrl = withDatabase(TARGET_URL, RUNTIME_TMP);

  try {
    for (const name of [INIT_TMP, RUNTIME_TMP]) {
      await dropTmp(maintenanceUrl, name);
      await withClient(maintenanceUrl, (c) => c.query(`CREATE DATABASE "${name}"`));
    }

    // 1) init.sql
    const initSql = fs.readFileSync(path.join(root, 'db/init.sql'), 'utf8');
    await withClient(initUrl, (c) => c.query(initSql));

    // 2) runtime ensure*-ahel. DATABASE_URL peab olema seatud ENNE db.ts laadimist,
    //    sest Pool luuakse impordi hetkel.
    process.env.DATABASE_URL = runtimeUrl;
    const db = loadTs(path.join(root, 'src/lib/db.ts'));
    await db.ensureSchema();
    await loadTs(path.join(root, 'src/lib/company-financials.ts')).ensureFinancialSchema();
    await loadTs(path.join(root, 'src/lib/company-research-store.ts')).ensureResearchSchema();
    await loadTs(path.join(root, 'src/lib/score-tracking.ts')).ensureScoreTrackingSchema();
    // ensureClassificationColumns ei ole eksporditud; tühja DB peal teeb see kutse
    // ainult ALTER-id (järjekord on tühi, seega võrku ei puututa).
    await loadTs(path.join(root, 'src/lib/company-classification.ts')).enrichCompanyClassifications(1);
    await db.pool.end();

    const initObjects = await withClient(initUrl, readObjects);
    const runtimeObjects = await withClient(runtimeUrl, readObjects);

    for (const kind of Object.keys(OBJECT_QUERIES)) {
      const d = diffLists(initObjects[kind], runtimeObjects[kind]);
      sub(`${kind}: init=${initObjects[kind].length} runtime=${runtimeObjects[kind].length} shared=${d.shared}`);
      if (d.onlyA.length === 0 && d.onlyB.length === 0) {
        console.log('  identsed');
        continue;
      }
      if (d.onlyA.length) {
        console.log(`  AINULT init.sql-is (${d.onlyA.length}) — runtime EI loo:`);
        for (const x of d.onlyA.slice(0, 12)) console.log(`    - ${x}`);
        if (d.onlyA.length > 12) console.log(`    ... veel ${d.onlyA.length - 12}`);
      }
      if (d.onlyB.length) {
        console.log(`  AINULT runtime'is (${d.onlyB.length}) — init.sql EI loo:`);
        for (const x of d.onlyB.slice(0, 12)) console.log(`    + ${x}`);
        if (d.onlyB.length > 12) console.log(`    ... veel ${d.onlyB.length - 12}`);
      }
    }
  } finally {
    for (const name of [INIT_TMP, RUNTIME_TMP]) {
      await dropTmp(maintenanceUrl, name).catch((e) => console.error(`  koristus ebaõnnestus (${name}): ${e.message}`));
    }
    console.log('\n  ajutised andmebaasid kustutatud');
  }
}

// --- main ------------------------------------------------------------------

(async () => {
  console.log('=== Stock Discovery · schema:diff ===');
  console.log(`  režiim: ${COMPARE ? '--compare (loob 2 ajutist DB-d)' : 'READ-ONLY (ei CREATE/ALTER/DROP)'}`);
  await inspectTarget();
  await preflight();
  codeAudit();
  if (COMPARE) await structuralDiff();
  else {
    head('D. STRUKTUURNE DIFF — vahele jäetud');
    console.log('  Käivita `npm run schema:diff -- --compare`, et võrrelda init.sql ja runtime skeemi.');
    console.log('  See loob kaks ajutist andmebaasi ega puuduta sihtandmebaasi.');
  }
  console.log('');
  process.exit(0);
})().catch((error) => {
  console.error('schema:diff ebaõnnestus:', error.message);
  process.exit(1);
});
