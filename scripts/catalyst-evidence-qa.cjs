const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// Laeb pure TypeScript mooduli ilma buildita, et deterministlik QA saaks
// kasutada päris reegleid ja päris läve-konstante.
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

const catalyst = loadTs(path.join(process.cwd(), 'src/lib/catalyst-evidence.ts'));
const dataQuality = loadTs(path.join(process.cwd(), 'src/lib/data-quality.ts'));
const { buildCatalystSignals, deriveCatalystEvidence } = catalyst;

const asOf = new Date('2026-08-12T12:00:00Z');

// Ehitab päris kujuga CompanyFinancialSummary + data-quality sisendi.
function financials(metrics) {
  const entries = Object.entries(metrics).map(([metric, spec]) => [metric, {
    latest: {
      id: spec.id || 1,
      metric,
      value: spec.value,
      unit: spec.unit || 'USD',
      periodStart: null,
      periodEnd: spec.periodEnd,
      periodKind: spec.periodKind || 'quarter',
      fiscalYear: null,
      fiscalPeriod: null,
      form: spec.form || '10-Q',
      filedAt: spec.filedAt || '2026-08-10',
      accessionNumber: spec.accession || '0000000000-26-000001',
      taxonomy: 'us-gaap',
      tag: metric,
      derived: false,
      sourceUrl: 'https://www.sec.gov/qa',
    },
    previousComparable: spec.previousValue == null ? null : {
      id: 2, metric, value: spec.previousValue, unit: spec.unit || 'USD',
      periodStart: null, periodEnd: spec.previousPeriodEnd || '2025-06-30',
      periodKind: spec.periodKind || 'quarter', fiscalYear: null, fiscalPeriod: null,
      form: spec.form || '10-Q', filedAt: '2025-08-10', accessionNumber: 'prev',
      taxonomy: 'us-gaap', tag: metric, derived: false, sourceUrl: 'https://www.sec.gov/qa',
    },
    yearOverYearPercent: spec.changePercent ?? null,
  }]);
  return { ticker: 'QA', cik: '1', companyName: 'QA', refreshedAt: null, metrics: Object.fromEntries(entries) };
}

function signalsFor(metrics, marketCap) {
  const summary = financials(metrics);
  return buildCatalystSignals(summary, dataQuality.calculateDataQuality(summary, asOf), marketCap, asOf);
}

function disclosure(overrides = {}) {
  return {
    id: null,
    kind: 'earnings_disclosed',
    sourceKind: 'primary_sec',
    sourceRef: '0001630805-26-000068',
    occurredAt: '2026-08-10T00:00:00.000Z',
    headline: '10-Q',
    url: 'https://www.sec.gov/qa',
    accessionNumber: '0001630805-26-000068',
    form: '10-Q',
    linkedFactIds: [1, 2, 3],
    linkedPeriodEnd: '2026-06-30',
    linkedPeriodKind: 'quarter',
    ...overrides,
  };
}

// 1. BW-tüüpi juhtum: kvantifitseeritud suur muutus, aga segune suund.
const bw = deriveCatalystEvidence([disclosure()], signalsFor({
  revenue: { value: 319_720_000, previousValue: 138_800_000, changePercent: 130.3, periodEnd: '2026-06-30' },
  net_income: { value: 14_260_000, previousValue: -58_400_000, changePercent: 124.4, periodEnd: '2026-06-30' },
  operating_cash_flow: { value: 374_000, previousValue: -34_000_000, changePercent: 101.1, periodEnd: '2026-06-30', periodKind: 'ytd' },
  free_cash_flow: { value: -13_370_000, previousValue: -40_900_000, changePercent: 67.3, periodEnd: '2026-06-30', periodKind: 'ytd' },
  cash: { value: 308_630_000, changePercent: 1217.3, periodEnd: '2026-06-30', periodKind: 'instant' },
  debt: { value: 181_150_000, periodEnd: '2021-09-30', periodKind: 'instant' },
  shares_outstanding: { value: 148_970_000, changePercent: 47.3, periodEnd: '2026-08-04', periodKind: 'instant', unit: 'shares' },
}, 1_430_000_000), { asOf, nextScheduledAt: '2026-11-03T00:00:00.000Z', lastScheduledAt: null });
assert.equal(bw.status, 'material_new_evidence', 'BW: kvantifitseeritud Q2 tõend peab olema materiaalne');
assert.equal(bw.strongest.assessment.materiality, 'quantified_major', 'BW materiality peab olema major');
assert.equal(bw.strongest.assessment.direction, 'mixed', 'BW suund peab olema mixed, mitte improving');
assert.equal(bw.strongest.assessment.thesisRelevance, 'decisive', 'BW tõend puudutab otsustavat avatud küsimust');
assert.equal(bw.strongest.assessment.mandateRelevance, 'fits', 'BW kasv ja mastaap sobivad mandaadiga');
assert.equal(bw.criterionStatus, 'supported', 'BW catalyst kriteerium peab olema supported');
assert.ok(bw.counterEvidence.some((item) => item.includes('aktsiate arv')), 'BW dilution peab olema catalyst’i kõrval nähtav');
assert.ok(bw.counterEvidence.some((item) => item.includes('aegunud')), 'BW aegunud debt-sisend peab olema vastutõendina nähtav');

// 2. CAKE-tüüpi juhtum: päris positiivne sündmus, vale mandaadi jaoks.
const cake = deriveCatalystEvidence([disclosure({ sourceRef: 'cake-10q', accessionNumber: 'cake-10q' })], signalsFor({
  revenue: { value: 1_030_000_000, previousValue: 956_000_000, changePercent: 7.7, periodEnd: '2026-06-30' },
  net_income: { value: 68_390_000, previousValue: 54_800_000, changePercent: 24.8, periodEnd: '2026-06-30' },
  operating_cash_flow: { value: 188_930_000, previousValue: 135_700_000, changePercent: 39.2, periodEnd: '2026-06-30', periodKind: 'ytd' },
  free_cash_flow: { value: 102_620_000, previousValue: 51_400_000, changePercent: 99.7, periodEnd: '2026-06-30', periodKind: 'ytd' },
  shares_outstanding: { value: 49_760_000, changePercent: -0.1, periodEnd: '2026-07-27', periodKind: 'instant', unit: 'shares' },
}, 5_600_000_000), { asOf });
assert.equal(cake.status, 'material_new_evidence', 'CAKE sündmus on päris ja mõõdetav');
assert.equal(cake.strongest.assessment.materiality, 'quantified_minor', 'CAKE muutus on järkjärguline');
assert.equal(cake.strongest.assessment.direction, 'improving', 'CAKE suund on paranev');
assert.equal(cake.strongest.assessment.mandateRelevance, 'not_relevant', 'CAKE ei vasta varajase asümmeetria mandaadile');

// 3. PLUG false-positive kontroll: värske filing, kuid kvantifitseerimata muutus.
const plug = deriveCatalystEvidence([disclosure({ sourceRef: 'plug-10q', accessionNumber: 'plug-10q' })], signalsFor({
  revenue: { value: 178_300_000, previousValue: 173_900_000, changePercent: 2.5, periodEnd: '2026-06-30' },
  net_income: { value: -188_210_000, previousValue: -227_000_000, changePercent: 17.1, periodEnd: '2026-06-30' },
  operating_cash_flow: { value: -244_110_000, previousValue: -297_300_000, changePercent: 17.9, periodEnd: '2026-06-30', periodKind: 'ytd' },
  free_cash_flow: { value: -252_820_000, previousValue: -376_200_000, changePercent: 32.8, periodEnd: '2026-06-30', periodKind: 'ytd' },
  debt: { value: 3_900_000, changePercent: -4.9, periodEnd: '2024-09-30', periodKind: 'instant' },
  shares_outstanding: { value: 1_400_000_000, changePercent: 21, periodEnd: '2026-08-06', periodKind: 'instant', unit: 'shares' },
}, 3_060_000_000), { asOf });
assert.equal(plug.status, 'weak_or_unconfirmed', 'PLUG ei tohi jõuda materiaalse tõendini');
assert.equal(plug.strongest.assessment.materiality, 'unquantified', 'PLUG revenue +2,5% ei ole kvantifitseeritud materiaalne muutus');
assert.equal(plug.criterionStatus, 'uncertain', 'PLUG catalyst kriteerium ei tohi olla supported');
assert.ok(plug.tier < bw.tier, 'PLUG peab järjestuses jääma BW alla');
assert.ok(plug.unknowns.some((item) => item.includes('kvantifitseerimata')), 'PLUG kvantifitseerimata materiality peab olema kirjas');

// 3b. Värske pealkiri ei tohi varjata sama ettevõtte nõrka avaldatud aruannet.
const plugWithNews = deriveCatalystEvidence([
  {
    ...disclosure({ sourceRef: 'plug-news' }),
    kind: 'news_headline',
    sourceKind: 'secondary_news',
    occurredAt: '2026-08-11T00:00:00.000Z',
    form: null,
    linkedFactIds: [],
    linkedPeriodEnd: null,
    linkedPeriodKind: null,
  },
  disclosure({ sourceRef: 'plug-10q', occurredAt: '2026-08-10T00:00:00.000Z' }),
], signalsFor({
  revenue: { value: 178_300_000, previousValue: 173_900_000, changePercent: 2.5, periodEnd: '2026-06-30' },
  operating_cash_flow: { value: -244_110_000, previousValue: -297_300_000, changePercent: 17.9, periodEnd: '2026-06-30', periodKind: 'ytd' },
  shares_outstanding: { value: 1_400_000_000, changePercent: 21, periodEnd: '2026-08-06', periodKind: 'instant', unit: 'shares' },
}, 3_060_000_000), { asOf });
assert.equal(plugWithNews.status, 'weak_or_unconfirmed', 'pealkiri ei tõsta PLUG staatust');
assert.equal(plugWithNews.strongest.event.kind, 'earnings_disclosed', 'tugevaim tõend peab olema avaldatud aruanne, mitte uudis');
assert.equal(plugWithNews.strongest.assessment.materiality, 'unquantified', 'nõrkuse põhjus peab olema aruande kvantifitseerimata muutus');

// 4. Pealkiri ei kvalifitseeru, ka siis kui numbrid on tugevad.
const headlineOnly = deriveCatalystEvidence([{
  ...disclosure({ sourceRef: 'news-1' }),
  kind: 'news_headline',
  sourceKind: 'secondary_news',
  form: null,
  linkedFactIds: [],
  linkedPeriodEnd: null,
  linkedPeriodKind: null,
}], signalsFor({
  revenue: { value: 319_720_000, previousValue: 138_800_000, changePercent: 130.3, periodEnd: '2026-06-30' },
  net_income: { value: 14_260_000, previousValue: -58_400_000, changePercent: 124.4, periodEnd: '2026-06-30' },
}, 1_000_000_000), { asOf });
assert.equal(headlineOnly.status, 'weak_or_unconfirmed', 'pealkiri ei tohi tõsta staatust materiaalseks');
assert.equal(headlineOnly.strongest.assessment.materiality, 'unknown', 'pealkirjal ei ole kvantifitseeritud sisu');
assert.equal(headlineOnly.strongest.assessment.novelty, 'unknown', 'pealkiri ei tõenda uudsust');

// 5. Administratiivne vorm (Form 144) ei ole tõend.
const routine = deriveCatalystEvidence([{
  ...disclosure({ sourceRef: '0001569880-26-000010' }),
  kind: 'sec_filing',
  form: '144',
  linkedFactIds: [],
  linkedPeriodEnd: null,
  linkedPeriodKind: null,
}], signalsFor({
  revenue: { value: 1_030_000_000, previousValue: 956_000_000, changePercent: 7.7, periodEnd: '2026-06-30' },
}, 5_600_000_000), { asOf });
assert.equal(routine.status, 'weak_or_unconfirmed', 'Form 144 ei tohi olla materiaalne tõend');
assert.equal(routine.strongest.assessment.thesisRelevance, 'not_relevant', 'administratiivne vorm ei puuduta teesi küsimust');

// 6. Ainult planeeritud kuupäev: pending, mitte supported.
const scheduled = deriveCatalystEvidence([{
  ...disclosure({ sourceRef: 'earnings-next' }),
  kind: 'earnings_scheduled',
  sourceKind: 'secondary_news',
  occurredAt: '2026-09-01T00:00:00.000Z',
  form: null,
  linkedFactIds: [],
  linkedPeriodEnd: null,
  linkedPeriodKind: null,
}], signalsFor({
  revenue: { value: 100, previousValue: 50, changePercent: 100, periodEnd: '2026-06-30' },
}, 1_000_000_000), { asOf, nextScheduledAt: '2026-09-01T00:00:00.000Z', lastScheduledAt: null });
assert.equal(scheduled.status, 'scheduled_only', 'tulevane earnings kuupäev on ainult jälgimissignaal');
assert.equal(scheduled.criterionStatus, 'uncertain', 'planeeritud kuupäev ei tohi olla supported');

// 7. Möödunud earnings kuupäev ilma uue avalduseta on kogumislünk.
const gap = deriveCatalystEvidence([], signalsFor({
  revenue: { value: 100, previousValue: 90, changePercent: 11, periodEnd: '2026-03-31' },
}, 1_000_000_000), { asOf, nextScheduledAt: null, lastScheduledAt: '2026-07-20T00:00:00.000Z' });
assert.equal(gap.status, 'collection_gap', 'möödunud avaldus ilma uue perioodita on kogumislünk');
assert.equal(gap.criterionStatus, 'missing', 'kogumislünk ei ole tõend');
assert.ok(gap.reasons.some((item) => item.includes('Oodatud avaldust ei ole kogutud')), 'kogumislünk peab olema sõnastatud');
assert.ok(gap.unknowns.some((item) => item.includes('ei tõenda')), 'kogumislünk ei tohi tähendada sündmusetust');

// 8. Sündmuste puudumine ei ole välistamise põhjus ega tõend sündmusetuse kohta.
const none = deriveCatalystEvidence([], signalsFor({
  revenue: { value: 100, previousValue: 90, changePercent: 11, periodEnd: '2026-06-30' },
}, 1_000_000_000), { asOf });
assert.equal(none.status, 'none_recorded', 'ilma sündmuseta on olek none_recorded');
assert.equal(none.tier, 0, 'none_recorded on madalaim tier');
assert.ok(none.reasons.some((item) => item.includes('ei ole tõend')), 'puuduv sündmus tuleb ausalt sõnastada');

// 9. Aegunud seotud periood ei tohi tõsta tõendibaasi.
const staleLinked = deriveCatalystEvidence([disclosure({
  sourceRef: 'stale-10k', linkedPeriodEnd: '2011-06-30', occurredAt: '2011-08-10T00:00:00.000Z',
})], signalsFor({
  revenue: { value: 100, previousValue: 10, changePercent: 900, periodEnd: '2011-06-30' },
}, 1_000_000_000), { asOf });
assert.equal(staleLinked.status, 'weak_or_unconfirmed', 'aegunud periood ei tohi anda materiaalset tõendit');
assert.equal(staleLinked.strongest.assessment.evidenceFreshness, 'stale', 'aegunud periood peab olema stale');

// 10. Sama perioodi kordusavaldus ei ole uus info.
const repeat = deriveCatalystEvidence([
  disclosure({ sourceRef: 'amended-10q', occurredAt: '2026-08-11T00:00:00.000Z' }),
  disclosure({ sourceRef: 'original-10q', occurredAt: '2026-08-01T00:00:00.000Z' }),
], signalsFor({
  revenue: { value: 319_720_000, previousValue: 138_800_000, changePercent: 130.3, periodEnd: '2026-06-30' },
}, 1_000_000_000), { asOf });
assert.equal(repeat.events[0].assessment.novelty, 'repeat_of_prior_event', 'hilisem sama perioodi avaldus ei ole uus info');
assert.equal(repeat.events[1].assessment.novelty, 'new_information', 'perioodi esimene avaldus kandis uue info');
assert.equal(repeat.strongest.event.sourceRef, 'original-10q', 'tugevaim tõend on perioodi esimene avaldus');
assert.equal(repeat.status, 'material_new_evidence', 'kordusavaldus ei kaota varasemat materiaalset tõendit');

console.log('Catalyst evidence deterministic QA: 11/11 passed');
