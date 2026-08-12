const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// Laeb pure TypeScript mooduli ilma buildita. under-recognition.ts kasutab ainult
// `import type` importe (transpile'il kustutatud), seega DB-d ei puudutata.
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

const { calculateUnderRecognitionEvidence } = loadTs(path.join(process.cwd(), 'src/lib/under-recognition.ts'));

function ev(input) { return calculateUnderRecognitionEvidence(input); }
const FIVE = ['meaningful', 'attention_only', 'no_attention_gap', 'low_confidence', 'unknown'];

// --- Cohort (docs/UNDER_RECOGNITION_AND_CHALLENGER.md § 4.1) ---
// Sisendid kodeerivad §4.1 kvalitatiivsed leiud (attention, catalyst, financials, data quality).
const cohort = {
  API: ev({ analystOpinions: 2, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: null, growthScore: 81, healthScore: 92, freshnessStatus: 'fresh', alignmentStatus: 'good' }),
  BW: ev({ analystOpinions: null, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: 'material_new_evidence', growthScore: 100, healthScore: 67, freshnessStatus: 'mixed', alignmentStatus: 'poor' }),
  HIMS: ev({ analystOpinions: 20, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: 'weak_or_unconfirmed', growthScore: 59, healthScore: 35, freshnessStatus: 'fresh', alignmentStatus: 'warning' }),
  CAKE: ev({ analystOpinions: 25, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: 'weak_or_unconfirmed', growthScore: 81, healthScore: 81, freshnessStatus: 'fresh', alignmentStatus: 'warning' }),
  ACHR: ev({ analystOpinions: 15, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: 'none_recorded', growthScore: 1, healthScore: 30, freshnessStatus: 'fresh', alignmentStatus: 'warning' }),
};

const expectedCohort = { API: 'meaningful', BW: 'low_confidence', HIMS: 'no_attention_gap', CAKE: 'no_attention_gap', ACHR: 'no_attention_gap' };
for (const ticker of Object.keys(expectedCohort)) {
  assert.equal(cohort[ticker].state, expectedCohort[ticker], `${ticker} must be ${expectedCohort[ticker]} (matches § 4.1)`);
}

// Guardrails § 6
assert.equal(cohort.BW.state, 'low_confidence', 'BW stays low_confidence (improving evidence but poor alignment)');
assert.notEqual(cohort.ACHR.state, 'meaningful', 'ACHR never meaningful from narrative alone');
assert.notEqual(cohort.CAKE.state, 'meaningful', 'CAKE never meaningful from being a good company');

// --- Viis olekut, deterministlikud ---
// meaningful: madal tähelepanu + paranev tõend + usaldusväärne andmed + health ok
assert.equal(ev({ analystOpinions: 2, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: null, growthScore: 81, healthScore: 90, freshnessStatus: 'fresh', alignmentStatus: 'good' }).state, 'meaningful', 'meaningful case');

// attention_only: madal tähelepanu, aga tõend ei parane
assert.equal(ev({ analystOpinions: 2, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: null, growthScore: 50, healthScore: 80, freshnessStatus: 'fresh', alignmentStatus: 'good' }).state, 'attention_only', 'attention_only case (low attention, no improving evidence)');

// no_attention_gap: kõrge tähelepanu
assert.equal(ev({ analystOpinions: 30, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: null, growthScore: 90, healthScore: 90, freshnessStatus: 'fresh', alignmentStatus: 'good' }).state, 'no_attention_gap', 'no_attention_gap case (high attention)');

// low_confidence: paranev tõend, aga poor alignment
assert.equal(ev({ analystOpinions: null, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: 'material_new_evidence', growthScore: 100, healthScore: 60, freshnessStatus: 'mixed', alignmentStatus: 'poor' }).state, 'low_confidence', 'low_confidence case (improving but poor data)');

// low_confidence via health survival risk (penny-stock guard)
assert.equal(ev({ analystOpinions: 2, marketCapPercentile: 10, sectorComparableCount: 8, catalystStatus: 'material_new_evidence', growthScore: 90, healthScore: 20, freshnessStatus: 'fresh', alignmentStatus: 'good' }).state, 'low_confidence', 'health survival risk blocks meaningful even with attention gap + evidence');

// unknown: kõik teadmata
const unknown = ev({ analystOpinions: null, marketCapPercentile: null, sectorComparableCount: null, catalystStatus: null, growthScore: null, healthScore: null, freshnessStatus: 'unknown', alignmentStatus: 'unknown' });
assert.equal(unknown.state, 'unknown', 'unknown case (no signals)');

// --- Unknown-first: puuduv info ei muutu oletuseks ---
assert.equal(unknown.analystAttention.value, 'unknown', 'missing analyst coverage → unknown');
assert.equal(unknown.marketCapContext.value, 'unknown', 'missing sector percentile → unknown');
assert.equal(unknown.catalystNovelty.value, 'unknown', 'missing catalyst → unknown');
assert.equal(unknown.improvingFinancials.value, 'unknown', 'missing growth → unknown');
// V0: frequency ja price reaction on alati unknown
assert.equal(cohort.API.discoveryFrequency.value, 'unknown', 'V0 frequency is always unknown');
assert.equal(cohort.API.priceReaction.value, 'unknown', 'V0 price reaction is always unknown');

// market cap percentile ainult ≥5 võrreldava korral
assert.equal(ev({ analystOpinions: null, marketCapPercentile: 10, sectorComparableCount: 3, catalystStatus: null, growthScore: null, healthScore: null, freshnessStatus: 'unknown', alignmentStatus: 'unknown' }).marketCapContext.value, 'unknown', 'percentile with <5 comparables → unknown');

// --- Ei ühtegi numbrit/skoori: state on üks viiest tekstist ---
for (const ticker of Object.keys(cohort)) {
  assert.ok(FIVE.includes(cohort[ticker].state), `${ticker} state is one of the five text states, not a number`);
  assert.equal(typeof cohort[ticker].state, 'string', 'state is a string, not a numeric score');
}

console.log('Cohort states:', Object.fromEntries(Object.keys(cohort).map((t) => [t, cohort[t].state])));
console.log('Under-recognition deterministic QA: 18/18 passed');
