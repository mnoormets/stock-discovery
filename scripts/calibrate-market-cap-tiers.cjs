// Read-only historical calibration for a possible canonical market-cap tier policy.
//
// Compares each stored rklb_daily top five with a counterfactual top three in
// each fixed market-cap tier. It uses only immutable discovery decisions and
// already-recorded candidate outcomes; it never reconstructs old evidence from
// current company data and never writes to PostgreSQL.

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const {
  loadEnv,
  loadTs,
  ensureLocalDatabaseUrl,
  registerRepoModules,
  repoRoot,
} = require('./_ts-loader.cjs');

const SCHEMA_VERSION = 'market-cap-tier-counterfactual-v1';
const CALIBRATION_THROUGH_DATE = '2026-08-29';
const CALIBRATION_MODEL_VERSIONS = ['rklb-discovery-v1', 'rklb-discovery-v2'];
const CONNECTION_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const LOWER_TIER_MAX_EXCLUSIVE = 10_000_000_000;
const UPPER_TIER_MAX_INCLUSIVE = 75_000_000_000;
const TIER_QUOTA = 3;
const CAPACITY_EXCLUSION_REASON = 'Läbis baasfiltrid, kuid jäi viie kõrgeima järjestusega kandidaadi piirist välja.';
const TIERS = ['below_10b', '10b_to_75b'];

const root = repoRoot();
registerRepoModules(root);
const { compareRklbRankFactors } = loadTs(path.join(root, 'src/lib/rklb-ranking.ts'));

function poolConfig(connectionString) {
  return {
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  };
}

function parseArgs(argv) {
  const options = { output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== '--output') throw new Error(`Unknown argument: ${flag}`);
    if (!value || value.startsWith('--')) throw new Error('--output requires a path.');
    options.output = value;
    index += 1;
  }
  return options;
}

function asNumber(value) {
  return value == null ? null : Number(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapDecision(row) {
  return {
    id: Number(row.id),
    runId: Number(row.run_id),
    ticker: String(row.ticker),
    included: Boolean(row.included),
    candidateRank: asNumber(row.candidate_rank),
    exclusionReasons: asArray(row.exclusion_reasons),
    marketCap: asNumber(row.market_cap),
    growthScore: asNumber(row.growth_score),
    healthScore: asNumber(row.health_score),
    coverageScore: Number(row.coverage_score),
    catalystTier: asNumber(row.catalyst_evidence_tier),
    supportedCriteriaCount: asArray(row.criteria)
      .filter((criterion) => criterion?.status === 'supported').length,
  };
}

function mapOutcome(row) {
  return {
    decisionId: Number(row.decision_id),
    horizon: String(row.horizon),
    status: String(row.status),
    returnPercent: asNumber(row.return_percent),
    excessReturnPercent: asNumber(row.excess_return_percent),
  };
}

function baseEligible(decision) {
  return decision.included
    || (decision.exclusionReasons.length === 1
      && decision.exclusionReasons[0] === CAPACITY_EXCLUSION_REASON);
}

function marketCapTier(marketCap) {
  if (marketCap == null) return 'unknown';
  if (marketCap < LOWER_TIER_MAX_EXCLUSIVE) return 'below_10b';
  if (marketCap <= UPPER_TIER_MAX_INCLUSIVE) return '10b_to_75b';
  return 'above_75b';
}

function rankFactors(decision) {
  return {
    ticker: decision.ticker,
    supportedCriteriaCount: decision.supportedCriteriaCount,
    catalystTier: decision.catalystTier,
    growthScore: decision.growthScore,
    coverageScore: decision.coverageScore,
    healthScore: decision.healthScore,
  };
}

function compareDecisions(a, b) {
  return compareRklbRankFactors(rankFactors(a), rankFactors(b));
}

function sortedTickers(decisions) {
  return decisions.map((decision) => decision.ticker);
}

function intersection(a, b) {
  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value));
}

function difference(a, b) {
  const bSet = new Set(b);
  return a.filter((value) => !bSet.has(value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[midpoint] : (ordered[midpoint - 1] + ordered[midpoint]) / 2;
}

function round(value, digits = 2) {
  return value == null ? null : Number(value.toFixed(digits));
}

function longestConsecutiveRun(selectedByRun, ticker) {
  let longest = 0;
  let current = 0;
  for (const tickers of selectedByRun) {
    if (tickers.includes(ticker)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function occupancy(selectedByRun) {
  const counts = new Map();
  for (const tickers of selectedByRun) {
    for (const ticker of tickers) counts.set(ticker, (counts.get(ticker) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([ticker, selectedRuns]) => ({
      ticker,
      selectedRuns,
      runSharePercent: round((selectedRuns / selectedByRun.length) * 100, 1),
      longestConsecutiveRuns: longestConsecutiveRun(selectedByRun, ticker),
    }))
    .sort((a, b) => b.selectedRuns - a.selectedRuns || a.ticker.localeCompare(b.ticker));
}

function turnover(selectedByRun) {
  const transitions = [];
  for (let index = 1; index < selectedByRun.length; index += 1) {
    const previous = selectedByRun[index - 1];
    const current = selectedByRun[index];
    const retained = intersection(current, previous);
    const entered = difference(current, previous);
    const exited = difference(previous, current);
    const unionSize = new Set([...previous, ...current]).size;
    transitions.push({
      retained: retained.length,
      entered: entered.length,
      exited: exited.length,
      jaccardPercent: unionSize ? (retained.length / unionSize) * 100 : 100,
    });
  }
  return {
    transitions: transitions.length,
    averageRetained: round(mean(transitions.map((item) => item.retained))),
    averageEntered: round(mean(transitions.map((item) => item.entered))),
    averageExited: round(mean(transitions.map((item) => item.exited))),
    averageJaccardPercent: round(mean(transitions.map((item) => item.jaccardPercent)), 1),
  };
}

function outcomeStats(selectedDecisionIds, outcomes) {
  const ids = new Set(selectedDecisionIds);
  const selected = outcomes.filter((outcome) => ids.has(outcome.decisionId));
  const horizons = [...new Set(outcomes.map((outcome) => outcome.horizon))].sort();
  return Object.fromEntries(horizons.map((horizon) => {
    const rows = selected.filter((outcome) => outcome.horizon === horizon);
    const measured = rows.filter((outcome) => outcome.status === 'measured' && outcome.returnPercent != null);
    const returns = measured.map((outcome) => outcome.returnPercent);
    const excessReturns = measured
      .map((outcome) => outcome.excessReturnPercent)
      .filter((value) => value != null);
    return [horizon, {
      trackedSelections: rows.length,
      measured: measured.length,
      pending: rows.filter((outcome) => outcome.status === 'pending').length,
      missing: rows.filter((outcome) => outcome.status === 'missing').length,
      unavailable: rows.filter((outcome) => outcome.status === 'unavailable').length,
      averageReturnPercent: round(mean(returns)),
      medianReturnPercent: round(median(returns)),
      averageExcessReturnPercent: round(mean(excessReturns)),
    }];
  }));
}

function selectionPatternSummary(runs) {
  const summary = {};
  for (const strategy of ['current', 'counterfactual']) {
    summary[strategy] = {};
    for (const tier of TIERS) {
      const selections = runs.map((run) => run[strategy].byTier[tier]);
      summary[strategy][tier] = {
        selectionObservations: selections.reduce((sum, tickers) => sum + tickers.length, 0),
        turnover: turnover(selections),
        occupancy: occupancy(selections),
      };
    }
  }
  return summary;
}

function comparisonSummary(runs) {
  return {
    totalOverlap: runs.reduce((sum, run) => sum + run.comparison.overlap.length, 0),
    totalAddedByCounterfactual: runs.reduce((sum, run) => sum + run.comparison.addedByCounterfactual.length, 0),
    totalDroppedFromCurrent: runs.reduce((sum, run) => sum + run.comparison.droppedFromCurrent.length, 0),
    runsWithIdenticalSelection: runs.filter((run) => run.comparison.addedByCounterfactual.length === 0 && run.comparison.droppedFromCurrent.length === 0).length,
  };
}

function buildCalibration(runRows, decisionRows, outcomeRows) {
  const decisionsByRun = new Map();
  for (const raw of decisionRows) {
    const decision = mapDecision(raw);
    if (!decisionsByRun.has(decision.runId)) decisionsByRun.set(decision.runId, []);
    decisionsByRun.get(decision.runId).push(decision);
  }
  const outcomes = outcomeRows.map(mapOutcome);
  const runs = runRows.map((row) => {
    const decisions = decisionsByRun.get(Number(row.id)) || [];
    const eligible = decisions.filter(baseEligible).sort(compareDecisions);
    const eligibleByTier = Object.fromEntries(TIERS.map((tier) => [
      tier,
      eligible.filter((decision) => marketCapTier(decision.marketCap) === tier),
    ]));
    const current = decisions
      .filter((decision) => decision.included)
      .sort((a, b) => (a.candidateRank ?? Number.MAX_SAFE_INTEGER) - (b.candidateRank ?? Number.MAX_SAFE_INTEGER));
    const counterfactualByTier = Object.fromEntries(TIERS.map((tier) => [
      tier,
      eligibleByTier[tier].slice(0, TIER_QUOTA),
    ]));
    const counterfactual = TIERS.flatMap((tier) => counterfactualByTier[tier]);
    const currentTickers = sortedTickers(current);
    const counterfactualTickers = sortedTickers(counterfactual);
    return {
      runId: Number(row.id),
      decisionDate: String(row.decision_date),
      modelVersion: String(row.model_version),
      eligibleCount: eligible.length,
      unclassifiedEligible: eligible.filter((decision) => !TIERS.includes(marketCapTier(decision.marketCap))).map((decision) => ({
        ticker: decision.ticker,
        marketCap: decision.marketCap,
        derivedTier: marketCapTier(decision.marketCap),
      })),
      eligibleByTier: Object.fromEntries(TIERS.map((tier) => [tier, eligibleByTier[tier].length])),
      current: {
        tickers: currentTickers,
        byTier: Object.fromEntries(TIERS.map((tier) => [
          tier,
          current.filter((decision) => marketCapTier(decision.marketCap) === tier).map((decision) => decision.ticker),
        ])),
      },
      counterfactual: {
        tickers: counterfactualTickers,
        byTier: Object.fromEntries(TIERS.map((tier) => [tier, sortedTickers(counterfactualByTier[tier])])),
      },
      comparison: {
        overlap: intersection(counterfactualTickers, currentTickers),
        addedByCounterfactual: difference(counterfactualTickers, currentTickers),
        droppedFromCurrent: difference(currentTickers, counterfactualTickers),
      },
      currentDecisionIds: current.map((decision) => decision.id),
      counterfactualDecisionIds: counterfactual.map((decision) => decision.id),
      currentDecisionIdsByTier: Object.fromEntries(TIERS.map((tier) => [
        tier,
        current.filter((decision) => marketCapTier(decision.marketCap) === tier).map((decision) => decision.id),
      ])),
      counterfactualDecisionIdsByTier: Object.fromEntries(TIERS.map((tier) => [
        tier,
        counterfactualByTier[tier].map((decision) => decision.id),
      ])),
    };
  });

  const allCurrentIds = runs.flatMap((run) => run.currentDecisionIds);
  const allCounterfactualIds = runs.flatMap((run) => run.counterfactualDecisionIds);
  const trackedDecisionIds = new Set(outcomes.map((outcome) => outcome.decisionId));
  const modelVersions = [...new Set(runs.map((run) => run.modelVersion))];
  const availability = Object.fromEntries(TIERS.map((tier) => {
    const short = runs.filter((run) => run.eligibleByTier[tier] < TIER_QUOTA);
    return [tier, {
      runsBelowQuota: short.length,
      runPercent: round((short.length / runs.length) * 100, 1),
      dates: short.map((run) => ({ date: run.decisionDate, eligible: run.eligibleByTier[tier], modelVersion: run.modelVersion })),
    }];
  }));

  const selectionPatterns = selectionPatternSummary(runs);

  const firstSustainedFullQuotaIndex = runs.findIndex((run, index) => (
    TIERS.every((tier) => run.eligibleByTier[tier] >= TIER_QUOTA)
    && runs.slice(index).every((later) => TIERS.every((tier) => later.eligibleByTier[tier] >= TIER_QUOTA))
  ));
  const fullQuotaRuns = firstSustainedFullQuotaIndex < 0 ? [] : runs.slice(firstSustainedFullQuotaIndex);

  const counterfactualTrackedIds = allCounterfactualIds.filter((id) => trackedDecisionIds.has(id));
  const report = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    policy: {
      lowerTier: { id: 'below_10b', marketCap: '< 10000000000' },
      upperTier: { id: '10b_to_75b', marketCap: '>= 10000000000 and <= 75000000000' },
      quotaPerTier: TIER_QUOTA,
      comparator: 'stored supported criteria count, catalyst tier, Growth, Coverage, Health, ticker',
      eligibility: `stored included decision or sole exclusion reason exactly: ${CAPACITY_EXCLUSION_REASON}`,
    },
    coverage: {
      canonicalRuns: runs.length,
      firstDate: runs[0]?.decisionDate || null,
      lastDate: runs.at(-1)?.decisionDate || null,
      modelVersions,
      currentSelectionObservations: allCurrentIds.length,
      counterfactualSelectionObservations: allCounterfactualIds.length,
      counterfactualSelectionsWithStoredOutcomes: counterfactualTrackedIds.length,
      counterfactualSelectionsWithoutStoredOutcomes: allCounterfactualIds.length - counterfactualTrackedIds.length,
    },
    availability,
    comparison: comparisonSummary(runs),
    selectionPatterns,
    sustainedFullQuotaEra: fullQuotaRuns.length ? {
      firstDate: fullQuotaRuns[0].decisionDate,
      lastDate: fullQuotaRuns.at(-1).decisionDate,
      runs: fullQuotaRuns.length,
      comparison: comparisonSummary(fullQuotaRuns),
      selectionPatterns: selectionPatternSummary(fullQuotaRuns),
    } : null,
    outcomes: {
      current: outcomeStats(allCurrentIds, outcomes),
      counterfactualTrackedOverlapOnly: outcomeStats(counterfactualTrackedIds, outcomes),
      currentByTier: Object.fromEntries(TIERS.map((tier) => [
        tier,
        outcomeStats(runs.flatMap((run) => run.currentDecisionIdsByTier[tier]), outcomes),
      ])),
      counterfactualTrackedOverlapOnlyByTier: Object.fromEntries(TIERS.map((tier) => {
        const ids = runs.flatMap((run) => run.counterfactualDecisionIdsByTier[tier])
          .filter((id) => trackedDecisionIds.has(id));
        return [tier, outcomeStats(ids, outcomes)];
      })),
      limitation: 'candidate_outcomes exist only for actually included historical decisions. Counterfactual-only selections are untracked, so this is not a valid head-to-head policy outcome comparison.',
    },
    runs: runs.map(({
      currentDecisionIds,
      counterfactualDecisionIds,
      currentDecisionIdsByTier,
      counterfactualDecisionIdsByTier,
      ...run
    }) => run),
  };
  return report;
}

async function captureCalibration(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const runs = (await client.query(`SELECT id, decision_date::text, model_version
      FROM discovery_runs
      WHERE run_type = 'rklb_daily'
        AND decision_date <= $1::date
        AND model_version = ANY($2::text[])
      ORDER BY decision_date, id`, [CALIBRATION_THROUGH_DATE, CALIBRATION_MODEL_VERSIONS])).rows;
    const decisions = (await client.query(`SELECT d.id, d.run_id, d.ticker, d.included,
        d.candidate_rank, d.exclusion_reasons, d.market_cap, d.growth_score,
        d.health_score, d.coverage_score, d.catalyst_evidence_tier, d.criteria
      FROM discovery_decisions d
      JOIN discovery_runs r ON r.id = d.run_id
      WHERE r.run_type = 'rklb_daily'
        AND r.decision_date <= $1::date
        AND r.model_version = ANY($2::text[])
      ORDER BY r.decision_date, r.id, d.ticker`, [CALIBRATION_THROUGH_DATE, CALIBRATION_MODEL_VERSIONS])).rows;
    const outcomes = (await client.query(`SELECT o.decision_id, o.horizon, o.status,
        o.return_percent, o.excess_return_percent
      FROM candidate_outcomes o
      JOIN discovery_decisions d ON d.id = o.decision_id
      JOIN discovery_runs r ON r.id = d.run_id
      WHERE r.run_type = 'rklb_daily'
        AND r.decision_date <= $1::date
        AND r.model_version = ANY($2::text[])
      ORDER BY o.decision_id, o.horizon`, [CALIBRATION_THROUGH_DATE, CALIBRATION_MODEL_VERSIONS])).rows;
    await client.query('ROLLBACK');
    return buildCalibration(runs, decisions, outcomes);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function formatPercent(value) {
  return value == null ? 'n/a' : `${value}%`;
}

function renderReport(report) {
  const lines = [
    'Market-cap tier counterfactual calibration',
    `Schema: ${report.schemaVersion}`,
    `Runs: ${report.coverage.canonicalRuns} (${report.coverage.firstDate} .. ${report.coverage.lastDate})`,
    `Models: ${report.coverage.modelVersions.join(', ')}`,
    `Actual selection observations: ${report.coverage.currentSelectionObservations}`,
    `Counterfactual selection observations: ${report.coverage.counterfactualSelectionObservations}`,
    `Overlap: ${report.comparison.totalOverlap}; added: ${report.comparison.totalAddedByCounterfactual}; dropped: ${report.comparison.totalDroppedFromCurrent}`,
    '',
    'Tier capacity:',
  ];
  for (const tier of TIERS) {
    const item = report.availability[tier];
    lines.push(`  ${tier}: below quota on ${item.runsBelowQuota}/${report.coverage.canonicalRuns} runs (${formatPercent(item.runPercent)})`);
    if (item.dates.length) lines.push(`    ${item.dates.map((date) => `${date.date}=${date.eligible}`).join(', ')}`);
  }
  lines.push('', 'Turnover and repeated occupancy:');
  for (const strategy of ['current', 'counterfactual']) {
    for (const tier of TIERS) {
      const item = report.selectionPatterns[strategy][tier];
      const leaders = item.occupancy.slice(0, 8).map((entry) => `${entry.ticker}:${entry.selectedRuns} (streak ${entry.longestConsecutiveRuns})`).join(', ');
      lines.push(`  ${strategy}/${tier}: selections ${item.selectionObservations}; avg retained ${item.turnover.averageRetained}, entered ${item.turnover.averageEntered}, exited ${item.turnover.averageExited}, Jaccard ${formatPercent(item.turnover.averageJaccardPercent)}`);
      lines.push(`    occupancy leaders: ${leaders || 'none'}`);
    }
  }
  if (report.sustainedFullQuotaEra) {
    const era = report.sustainedFullQuotaEra;
    lines.push('', `Sustained full-quota era: ${era.firstDate} .. ${era.lastDate} (${era.runs} runs)`);
    lines.push(`  overlap ${era.comparison.totalOverlap}; added ${era.comparison.totalAddedByCounterfactual}; dropped ${era.comparison.totalDroppedFromCurrent}`);
  }
  lines.push('', 'Outcome coverage:');
  lines.push(`  Counterfactual tracked: ${report.coverage.counterfactualSelectionsWithStoredOutcomes}; untracked: ${report.coverage.counterfactualSelectionsWithoutStoredOutcomes}`);
  for (const [strategy, stats] of Object.entries({ current: report.outcomes.current, counterfactual_overlap: report.outcomes.counterfactualTrackedOverlapOnly })) {
    for (const [horizon, item] of Object.entries(stats)) {
      lines.push(`  ${strategy}/${horizon}: tracked ${item.trackedSelections}, measured ${item.measured}, pending ${item.pending}, missing ${item.missing}, avg return ${formatPercent(item.averageReturnPercent)}, median ${formatPercent(item.medianReturnPercent)}`);
    }
  }
  lines.push(`  Limitation: ${report.outcomes.limitation}`);
  return `${lines.join('\n')}\n`;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  loadEnv(root);
  const pool = new Pool(poolConfig(ensureLocalDatabaseUrl()));
  try {
    const report = await captureCalibration(pool);
    process.stdout.write(renderReport(report));
    if (options.output) {
      fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.log(`JSON report: ${path.resolve(options.output)}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Market-cap tier calibration failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  SCHEMA_VERSION,
  CALIBRATION_THROUGH_DATE,
  CALIBRATION_MODEL_VERSIONS,
  CONNECTION_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  LOWER_TIER_MAX_EXCLUSIVE,
  UPPER_TIER_MAX_INCLUSIVE,
  TIER_QUOTA,
  CAPACITY_EXCLUSION_REASON,
  poolConfig,
  parseArgs,
  baseEligible,
  marketCapTier,
  buildCalibration,
  captureCalibration,
  renderReport,
};
