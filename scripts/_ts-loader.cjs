// Jagatud abimoodul lokaalsetele CLI-skriptidele.
// Kasutab sama TypeScript-i transpile mustrit, mida QA skriptid juba kasutavad:
// laeb rakenduse mooduleid ilma buildita ja resolveerib relatiivsed importid.
// EI sisalda ärilogikat — ainult laadimine ja keskkonna ettevalmistus.

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

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

// Laeb .env failist muutujad, kirjutamata üle juba seatud keskkonnamuutujaid.
function loadEnv(repoRoot) {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] != null && process.env[key] !== '') continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

// Rakenduse vaikimisi DATABASE_URL osutab Dockeri-sisesele hostile (db:5432),
// mis ei resolvu hostimasinast. Lokaalne CLI kasutab docker-compose-is
// avaldatud porti 5433. Olemasolevat DATABASE_URL-i ei kirjutata kunagi üle.
const LOCAL_DATABASE_URL = 'postgres://discovery:discovery@localhost:5433/discovery';

function ensureLocalDatabaseUrl() {
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  return process.env.DATABASE_URL;
}

function repoRoot() {
  return process.cwd();
}

// Node peab leidma repo node_modules (pg, typescript, yahoo-finance2).
function registerRepoModules(root) {
  module.paths.push(path.join(root, 'node_modules'));
}

module.exports = { loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules, LOCAL_DATABASE_URL };
