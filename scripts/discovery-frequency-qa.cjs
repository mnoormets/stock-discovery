const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// Laeb pure TypeScript mooduli ilma buildita, resolvides relatiivsed importid
// samamoodi kui catalyst QA. `computeDiscoveryFrequency` on puhas funktsioon;
// db pool luuakse laisalt ega tee importimisel päringut.
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

const { computeDiscoveryFrequency } = loadTs(path.join(process.cwd(), 'src/lib/discovery-frequency.ts'));

function dec(ticker, included, rank, ev = {}) {
  return {
    ticker,
    included,
    rank: rank ?? null,
    growthScore: ev.g ?? 80,
    healthScore: ev.h ?? 50,
    coverageScore: ev.c ?? 100,
    catalystEvidenceTier: ev.tier ?? 1,
    catalystEvidenceStatus: ev.status ?? 'material_new_evidence',
    catalystLinkedPeriodEnd: ev.period ?? '2026-06-30',
  };
}

// Kuus canonical otsusepäeva. AAA püsib muutumatu evidence'iga; BBB katkeb
// välistamisega; CCC katkeb universumist puudumisega; DDD ei kaasata kunagi;
// EEE on üks kaasamine; FFF-l muutub seotud periood (uus evidence).
const days = [
  { decisionDate: '2026-08-01', runId: 1, decisions: [dec('AAA', true, 3), dec('BBB', true, 2), dec('CCC', true, 4), dec('DDD', false, null)] },
  { decisionDate: '2026-08-02', runId: 2, decisions: [dec('AAA', true, 2), dec('BBB', true, 1), dec('CCC', true, 3), dec('DDD', false, null)] },
  { decisionDate: '2026-08-03', runId: 3, decisions: [dec('AAA', true, 2), dec('BBB', true, 1), dec('CCC', true, 2), dec('DDD', false, null)] },
  { decisionDate: '2026-08-04', runId: 4, decisions: [dec('AAA', true, 1), dec('BBB', true, 1), dec('CCC', true, 1), dec('DDD', false, null)] },
  { decisionDate: '2026-08-05', runId: 5, decisions: [dec('AAA', true, 1), dec('BBB', true, 1), dec('DDD', false, null), dec('FFF', true, 3, { period: '2026-03-31' })] },
  { decisionDate: '2026-08-06', runId: 6, decisions: [dec('AAA', true, 1), dec('BBB', false, null), dec('DDD', false, null), dec('EEE', true, 2), dec('FFF', true, 2, { period: '2026-06-30' })] },
];

const dash = computeDiscoveryFrequency(days);
const byTicker = Object.fromEntries(dash.tickers.map((t) => [t.ticker, t]));

// 1. Canonical päevade loend ja readiness (kuus päeva ≥ 5).
assert.equal(dash.canonicalDayCount, 6, 'six canonical decision days');
assert.equal(dash.readyForInterpretation, true, 'six days is enough to interpret');
assert.equal(dash.latestDecisionDate, '2026-08-06', 'latest decision date tracked');
assert.equal(dash.earliestDecisionDate, '2026-08-01', 'earliest decision date tracked');

// 2. Ainult vähemalt korra kaasatud kandidaadid; DDD jäetakse välja.
assert.ok(!byTicker.DDD, 'never-included ticker is excluded from frequency');
assert.deepEqual(Object.keys(byTicker).sort(), ['AAA', 'BBB', 'CCC', 'EEE', 'FFF'], 'only surfaced candidates listed');

// 3. Kaasamiste loend ja hinnatud päevade loend.
assert.equal(byTicker.AAA.includedCount, 6, 'AAA included on all six days');
assert.equal(byTicker.AAA.evaluatedCount, 6, 'AAA evaluated on all six days');
assert.equal(byTicker.CCC.includedCount, 4, 'CCC included four days');
assert.equal(byTicker.CCC.evaluatedCount, 4, 'CCC evaluated only when present, not on absent days');

// 4. Streak katkeb välistamisel (BBB) ja universumist puudumisel (CCC).
assert.equal(byTicker.AAA.currentStreak, 6, 'unbroken inclusion streak');
assert.equal(byTicker.BBB.currentStreak, 0, 'streak breaks when most recent day is excluded');
assert.equal(byTicker.CCC.currentStreak, 0, 'streak breaks when most recent day is absent');
assert.equal(byTicker.FFF.currentStreak, 2, 'two consecutive most-recent inclusions');
assert.equal(byTicker.EEE.currentStreak, 1, 'single most-recent inclusion is a streak of one');

// 5. Aknad 5/10/20 loevad kaasamisi viimaste canonical päevade seas.
const aaaW5 = byTicker.AAA.includedByWindow.find((w) => w.window === 5);
assert.equal(aaaW5.included, 5, 'AAA included in all of last five days');
assert.equal(aaaW5.canonicalDays, 5, 'window reports how many canonical days it saw');
const cccW5 = byTicker.CCC.includedByWindow.find((w) => w.window === 5);
assert.equal(cccW5.included, 3, 'CCC included three of last five days');

// 6. Persistence: sama evidence vs uus/muutunud evidence vs üks kaasamine.
assert.equal(byTicker.AAA.persistence, 'stale_evidence', 'identical evidence over time is stale persistence');
assert.equal(byTicker.FFF.persistence, 'evolving_evidence', 'changed linked period is evolving evidence');
assert.equal(byTicker.EEE.persistence, 'single', 'one inclusion cannot be classified as persistence');

// 7. Rank ei ole evidence: AAA rank muutus, aga jääb stale.
assert.equal(byTicker.AAA.firstRank, 3, 'first inclusion rank');
assert.equal(byTicker.AAA.lastRank, 1, 'last inclusion rank');
assert.equal(byTicker.AAA.rankChange, 2, 'rank change is first minus last (positive = improved)');
assert.equal(byTicker.EEE.rankChange, null, 'single inclusion has no rank change');

// 8. Timeline eristab included / excluded / absent.
assert.deepEqual(
  byTicker.CCC.timeline.map((e) => e.status),
  ['included', 'included', 'included', 'included', 'absent', 'absent'],
  'timeline distinguishes absent days from excluded days',
);
assert.equal(byTicker.BBB.timeline[5].status, 'excluded', 'BBB last day is excluded, not absent');

// 9. Järjestus on leksikograafiline: kaasamiste arv, siis streak, siis ticker.
assert.deepEqual(dash.tickers.map((t) => t.ticker), ['AAA', 'BBB', 'CCC', 'FFF', 'EEE'], 'ordered by inclusion count then streak');

// 10. Dedup: sama decision_date, suurim runId võidab.
const dedup = computeDiscoveryFrequency([
  { decisionDate: '2026-08-01', runId: 1, decisions: [dec('ZZZ', true, 1)] },
  { decisionDate: '2026-08-01', runId: 2, decisions: [dec('ZZZ', false, null)] },
]);
assert.equal(dedup.canonicalDayCount, 1, 'same-date runs collapse to one canonical day');
assert.equal(dedup.tickers.length, 0, 'latest run for the day wins (excluded), so ZZZ is not surfaced');

// 11. Vähene ajalugu ei ole tõlgendatav.
const shallow = computeDiscoveryFrequency(days.slice(0, 3));
assert.equal(shallow.canonicalDayCount, 3, 'three days counted honestly');
assert.equal(shallow.readyForInterpretation, false, 'fewer than five canonical days is not interpretable');

// 12. Tühi sisend on korrektne tulemus, mitte viga.
const empty = computeDiscoveryFrequency([]);
assert.equal(empty.canonicalDayCount, 0, 'no canonical runs yet');
assert.equal(empty.tickers.length, 0, 'no tickers without runs');
assert.equal(empty.readyForInterpretation, false, 'zero days is not interpretable');

console.log('Discovery frequency deterministic QA: 12/12 passed');
