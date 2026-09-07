const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// Laeb pure TypeScript mooduli ilma buildita, resolvides relatiivsed importid.
// calculateValuationEvidence on puhas funktsioon; data-quality on DB-vaba ja
// company-financials import on ainult tüüp (transpile'il kustutatud).
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

const { calculateValuationEvidence } = loadTs(path.join(process.cwd(), 'src/lib/valuation-evidence.ts'));

const asOf = new Date('2026-08-12T12:00:00Z');
function m(value, periodEnd, periodKind, extra = {}) {
  return {
    value, periodEnd, periodKind,
    accessionNumber: extra.accessionNumber || 'qa', sourceUrl: extra.sourceUrl || 'https://sec.gov/qa',
    derived: extra.derived || false,
  };
}
function anchor(summary, kind) {
  return summary.anchors.find((a) => a.kind === kind);
}

// 1. EV/Sales arvutub kvartalist annualiseeritud müügiga; confidence langeb
//    annualiseerimise tõttu medium'ini.
const base = calculateValuationEvidence({
  marketCap: 1000,
  revenue: m(100, '2026-06-30', 'quarter'),
  netIncome: m(-20, '2026-06-30', 'quarter'),
  freeCashFlow: m(-10, '2026-06-30', 'quarter'),
  cash: m(50, '2026-06-30', 'instant'),
  debt: m(150, '2026-06-30', 'instant'),
}, asOf);
const evs = anchor(base, 'ev_sales');
assert.equal(evs.status, 'computable', 'EV/Sales computes from market cap + debt - cash / annualized sales');
assert.equal(Math.round(evs.value * 100) / 100, 2.75, 'EV 1100 / annualized sales 400 = 2.75x');
assert.equal(evs.unit, 'x', 'multiple unit');
assert.equal(evs.basis, 'annualized_from_quarter', 'quarterly revenue is annualized and labeled');
assert.equal(evs.confidence, 'medium', 'annualized-from-quarter caps confidence at medium');
assert.ok(evs.sources.length >= 3, 'EV/Sales cites revenue, cash and debt sources');

// 2. P/E ei ole tähenduslik negatiivse annualiseeritud kasumi juures.
const pe = anchor(base, 'pe');
assert.equal(pe.status, 'not_meaningful', 'negative earnings make P/E not meaningful');
assert.equal(pe.value, null, 'no P/E value when earnings are negative');

// 3. FCF Yield arvutub ka negatiivsena ja märgib raha põletamist.
const fcf = anchor(base, 'fcf_yield');
assert.equal(fcf.status, 'computable', 'FCF yield computes even when negative');
assert.equal(Math.round(fcf.value), -4, 'annualized FCF -40 / market cap 1000 = -4%');
assert.equal(fcf.unit, '%', 'yield unit');
assert.ok(fcf.note && fcf.note.includes('põletamist'), 'negative FCF yield is flagged as cash burn, not cheapness');

// 4. Peer comparison ja sum-of-parts on V1-s alati unknown.
assert.equal(anchor(base, 'peer_comparison').status, 'unknown', 'peer comparison is not computed in V1');
assert.equal(anchor(base, 'sum_of_parts').status, 'unknown', 'sum-of-parts is not computed in V1');

// 5. Alati täpselt viis ankrut, kõik kindluse kirjeldusega.
assert.equal(base.anchors.length, 5, 'always five anchors (unknown-first)');
assert.equal(base.marketCapKnown, true, 'market cap known');
assert.equal(base.hasAnyComputable, true, 'at least one computable anchor');

// 6. Positiivne kasum annab tähendusliku P/E; aastane sisend hoiab confidence kõrge.
const profitable = calculateValuationEvidence({
  marketCap: 1000,
  revenue: m(400, '2025-12-31', 'annual'),
  netIncome: m(50, '2025-12-31', 'annual'),
  freeCashFlow: null,
  cash: m(50, '2025-12-31', 'instant'),
  debt: m(150, '2025-12-31', 'instant'),
}, asOf);
const pe2 = anchor(profitable, 'pe');
assert.equal(pe2.status, 'computable', 'positive annual earnings give a meaningful P/E');
assert.equal(pe2.value, 20, 'market cap 1000 / earnings 50 = 20x');
assert.equal(pe2.basis, 'annual', 'annual earnings need no annualization');
assert.equal(pe2.confidence, 'high', 'fresh annual single input is high confidence');

// 7. Aegunud sisend (BW muster) langetab EV/Sales confidence'i madalaks.
const staleDebt = calculateValuationEvidence({
  marketCap: 1000,
  revenue: m(100, '2026-06-30', 'quarter'),
  netIncome: null,
  freeCashFlow: null,
  cash: m(50, '2026-06-30', 'instant'),
  debt: m(150, '2021-12-31', 'instant'),
}, asOf);
assert.equal(anchor(staleDebt, 'ev_sales').status, 'insufficient_data', 'stale debt blocks EV/Sales');
assert.equal(anchor(staleDebt, 'ev_sales').value, null, 'no misleading multiple is exposed');

// 8. Puuduv cash → EV/Sales andmeid napib (mitte vale EV).
const noCash = calculateValuationEvidence({
  marketCap: 1000,
  revenue: m(100, '2026-06-30', 'quarter'),
  netIncome: null, freeCashFlow: null,
  cash: null,
  debt: m(150, '2026-06-30', 'instant'),
}, asOf);
assert.equal(anchor(noCash, 'ev_sales').status, 'insufficient_data', 'EV needs both cash and debt');

// 9. Teadmata market cap → kõik hindamise ankrud andmeid napib, hasAnyComputable false.
const noCap = calculateValuationEvidence({
  marketCap: null,
  revenue: m(100, '2026-06-30', 'quarter'),
  netIncome: m(50, '2025-12-31', 'annual'),
  freeCashFlow: m(20, '2025-12-31', 'annual'),
  cash: m(50, '2026-06-30', 'instant'),
  debt: m(150, '2026-06-30', 'instant'),
}, asOf);
assert.equal(noCap.marketCapKnown, false, 'market cap unknown flagged');
assert.equal(anchor(noCap, 'ev_sales').status, 'insufficient_data', 'no EV/Sales without market cap');
assert.equal(anchor(noCap, 'pe').status, 'insufficient_data', 'no P/E without market cap');
assert.equal(anchor(noCap, 'fcf_yield').status, 'insufficient_data', 'no FCF yield without market cap');
assert.equal(noCap.hasAnyComputable, false, 'nothing computable without market cap');

// 10. YTD flow ei annualiseeru puhtalt → EV/Sales andmeid napib.
const ytd = calculateValuationEvidence({
  marketCap: 1000,
  revenue: m(200, '2026-06-30', 'ytd'),
  netIncome: null, freeCashFlow: null,
  cash: m(50, '2026-06-30', 'instant'),
  debt: m(150, '2026-06-30', 'instant'),
}, asOf);
assert.equal(anchor(ytd, 'ev_sales').status, 'insufficient_data', 'YTD revenue is not cleanly annualizable');

// 11. Täiesti tühi sisend on korrektne tulemus, mitte viga.
const empty = calculateValuationEvidence({
  marketCap: null, revenue: null, netIncome: null, freeCashFlow: null, cash: null, debt: null,
}, asOf);
assert.equal(empty.anchors.length, 5, 'empty input still lists all anchors');
assert.equal(empty.hasAnyComputable, false, 'nothing computable from empty input');

// 12. Ükski ankur ei tagasta koondskoori: unit on ainult x, % või null.
for (const a of base.anchors) {
  assert.ok([null, 'x', '%'].includes(a.unit), `anchor ${a.kind} exposes a ratio unit, never a composite score`);
}

console.log('Valuation evidence deterministic QA: 12/12 passed');
