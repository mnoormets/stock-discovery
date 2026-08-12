// Kiirstart + kontrollskript sector/industry klassifikatsioonile.
// Käivitab enrichCompanyClassifications(limit) päris DB vastu ja näitab
// enne/pärast katvust. EI ole destruktiivne: kirjutab ainult
// companies.sector/industry/classification_source/classification_updated_at,
// ja ainult ridadele, kus need on NULL.
//
// Kasutus (repo kaustast, DB port 5433 vaikimisi):
//   node scripts/classify-universe.cjs            # limit 100 (kogu väike universum)
//   node scripts/classify-universe.cjs 5          # bounded batch nagu päevane collect
//   DATABASE_URL=... node scripts/classify-universe.cjs

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://discovery:discovery@localhost:5433/discovery';

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const repo = process.cwd();
const loaded = new Map();
function loadTs(absPath) {
  if (loaded.has(absPath)) return loaded.get(absPath);
  const compiled = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new Module(absPath, module);
  mod.filename = absPath;
  mod.paths = module.paths;
  const nodeRequire = mod.require.bind(mod);
  mod.require = (request) => (request.startsWith('.')
    ? loadTs(path.resolve(path.dirname(absPath), request.endsWith('.ts') ? request : `${request}.ts`))
    : nodeRequire(request));
  loaded.set(absPath, mod.exports);
  mod._compile(compiled, absPath);
  loaded.set(absPath, mod.exports);
  return mod.exports;
}
module.paths.push(path.join(repo, 'node_modules'));

const { pool } = loadTs(path.join(repo, 'src/lib/db.ts'));
const { enrichCompanyClassifications } = loadTs(path.join(repo, 'src/lib/company-classification.ts'));

async function coverage() {
  const r = await pool.query(`
    SELECT count(*)::int total,
           count(sector)::int with_sector,
           count(industry)::int with_industry,
           count(*) FILTER (WHERE classification_source='yahoo')::int yahoo
    FROM companies;`);
  return r.rows[0];
}

(async () => {
  const limit = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 100;
  const before = await coverage();
  console.log('BEFORE:', before);
  const result = await enrichCompanyClassifications(limit);
  console.log('RESULT:', {
    attempted: result.attempted, enriched: result.enriched,
    unavailable: result.unavailable, failed: result.failed, remaining: result.remaining,
  });
  if (result.enrichedTickers.length) console.log('  enriched:', result.enrichedTickers.join(', '));
  if (result.unavailableTickers.length) console.log('  unavailable:', result.unavailableTickers.join(', '));
  if (result.failedTickers.length) console.log('  failed:', result.failedTickers.join(', '));
  const after = await coverage();
  console.log('AFTER:', after);
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
