const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const filename = path.join(process.cwd(), 'src/lib/data-quality.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { calculateDataQualityFromMetrics } = loaded.exports;

const asOf = new Date('2026-08-11T12:00:00Z');
const metric = (name, periodEnd, periodKind = 'instant') => ({
  metric: name, value: 1, unit: 'USD', periodEnd, periodKind,
  factId: 1, accessionNumber: 'qa', sourceUrl: 'https://www.sec.gov/qa',
});

const aligned = calculateDataQualityFromMetrics([
  metric('cash', '2026-06-30'), metric('debt', '2026-06-30'),
], asOf);
assert.equal(aligned.alignmentStatus, 'good', 'same-period inputs must align');

const oldMetric = calculateDataQualityFromMetrics([
  metric('cash', '2026-06-30'), metric('debt', '2022-12-31'),
], asOf);
assert.equal(oldMetric.alignmentStatus, 'poor', 'several-year-old input must make alignment poor');
assert.equal(oldMetric.freshnessStatus, 'mixed', 'one stale and one fresh input must be mixed');

const bwLike = calculateDataQualityFromMetrics([
  metric('cash', '2026-06-30'), metric('debt', '2021-12-31'),
], asOf);
assert.equal(bwLike.alignmentStatus, 'poor', 'cash 2026 + debt 2021 must be poor');

const unknown = calculateDataQualityFromMetrics([
  metric('cash', null), metric('debt', '2026-06-30'),
], asOf);
assert.equal(unknown.unknownPeriodCount, 1, 'unknown periods must be explicit');
assert.equal(unknown.alignmentStatus, 'unknown', 'one known period cannot prove alignment');

const highCoveragePoor = calculateDataQualityFromMetrics([
  metric('revenue', '2026-06-30', 'quarter'), metric('net_income', '2026-06-30', 'quarter'),
  metric('operating_cash_flow', '2026-06-30', 'ytd'), metric('free_cash_flow', '2026-06-30', 'ytd'),
  metric('cash', '2026-06-30'), metric('debt', '2021-12-31'), metric('shares_outstanding', '2026-06-30'),
], asOf);
assert.equal(highCoveragePoor.metrics.length, 7, 'all available inputs must remain visible');
assert.equal(highCoveragePoor.alignmentStatus, 'poor', 'high input coverage may coexist with poor alignment');

const missingMetric = calculateDataQualityFromMetrics([
  metric('cash', '2026-06-30'),
], asOf);
assert.equal(missingMetric.metrics.length, 1, 'missing metrics are not fabricated');
assert.equal(missingMetric.unknownPeriodCount, 0, 'missing metric is not an unknown period');
assert.equal(missingMetric.alignmentStatus, 'unknown', 'missing metric affects coverage elsewhere, not alignment');
assert.equal(missingMetric.periodSpanDays, null, 'a single known period has no comparable span');
assert.equal(unknown.periodSpanDays, null, 'one known period cannot produce a 0-day alignment claim');
assert.equal(aligned.periodSpanDays, 0, 'two same-period inputs have a real 0-day span');

console.log('Data quality deterministic QA: 7/7 passed');
