// Read-only CompanyFacts enrichment queue observer.
//
// Captures a point-in-time queue snapshot inside a PostgreSQL READ ONLY
// transaction. With --before, an after snapshot is combined into versioned
// JSON and NDJSON artifacts for daily calibration.

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { loadEnv, ensureLocalDatabaseUrl, repoRoot } = require('./_ts-loader.cjs');

const SCHEMA_VERSION = 'companyfacts-queue-observation-v1';
const CONNECTION_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const PHASES = new Set(['before', 'after']);
const COLLECTOR_STATUSES = new Set(['success', 'failure', 'cancelled', 'skipped', 'unknown']);
const COLLECTOR_MODES = new Set(['live', 'dry_run']);

function observerPoolConfig(connectionString) {
  return {
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  };
}

function createObserverPool(connectionString) {
  return new Pool(observerPoolConfig(connectionString));
}

function parseArgs(argv) {
  const options = {
    phase: null,
    output: null,
    before: null,
    report: null,
    ndjson: null,
    collectorStatus: 'unknown',
    collectorMode: 'live',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--phase', '--output', '--before', '--report', '--ndjson', '--collector-status', '--collector-mode'].includes(flag)) {
      throw new Error(`Tundmatu argument: ${flag}`);
    }
    if (!value || value.startsWith('--')) throw new Error(`${flag} vajab väärtust.`);
    index += 1;
    if (flag === '--phase') options.phase = value;
    else if (flag === '--output') options.output = value;
    else if (flag === '--before') options.before = value;
    else if (flag === '--report') options.report = value;
    else if (flag === '--ndjson') options.ndjson = value;
    else if (flag === '--collector-status') options.collectorStatus = value;
    else if (flag === '--collector-mode') options.collectorMode = value;
  }
  if (!PHASES.has(options.phase)) throw new Error('--phase peab olema before või after.');
  if (!COLLECTOR_STATUSES.has(options.collectorStatus)) {
    throw new Error(`Tundmatu collector status: ${options.collectorStatus}`);
  }
  if (!COLLECTOR_MODES.has(options.collectorMode)) {
    throw new Error(`Tundmatu collector mode: ${options.collectorMode}`);
  }
  if (options.phase === 'before' && (options.before || options.report || options.ndjson)) {
    throw new Error('before snapshot ei aktsepteeri --before, --report ega --ndjson argumente.');
  }
  return options;
}

function errorCategory(status, error) {
  if (status !== 'error' || !error) return null;
  const text = String(error).toLowerCase();
  if (text.includes('timeout') || text.includes('timed out')) return 'timeout';
  if (text.includes('429') || text.includes('rate limit')) return 'rate_limit';
  if (text.includes('fetch') || text.includes('network') || text.includes('eai_') || text.includes('socket')) return 'network';
  if (text.includes('parse') || text.includes('json') || text.includes('payload')) return 'parse';
  if (text.includes('http') || /\b[45]\d\d\b/.test(text)) return 'http';
  return 'other';
}

function mapStatus(row) {
  return {
    status: row.status || null,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at).toISOString() : null,
    attemptCount: null,
    attemptCountAvailability: 'not_stored',
    consecutiveFailures: Number(row.consecutive_failures || 0),
    errorCategory: errorCategory(row.status, row.last_error),
  };
}

const QUEUE_SQL = `
  WITH latest_prices AS (
    SELECT company_id, max(captured_at) AS latest_price_at
    FROM price_snapshots
    GROUP BY company_id
  ), latest_facts AS (
    SELECT company_id, max(updated_at) AS facts_updated_at
    FROM financial_facts
    GROUP BY company_id
  )
  SELECT c.id AS company_id, c.ticker, c.created_at,
         prices.latest_price_at, facts.facts_updated_at,
         CASE WHEN facts.facts_updated_at IS NULL THEN 'missing_facts' ELSE 'stale_facts' END AS eligibility_reason,
         enrichment.status, enrichment.last_attempt_at, enrichment.last_success_at,
         enrichment.consecutive_failures, enrichment.last_error,
         GREATEST(0, (
           (now() AT TIME ZONE 'Europe/Tallinn')::date
           - (c.created_at AT TIME ZONE 'Europe/Tallinn')::date
         ))::int AS first_observed_age_days
  FROM companies c
  JOIN latest_prices prices ON prices.company_id = c.id
  LEFT JOIN latest_facts facts ON facts.company_id = c.id
  LEFT JOIN financial_enrichment_status enrichment ON enrichment.company_id = c.id
  WHERE c.ticker <> 'SPY'
    AND c.quote_type IS DISTINCT FROM 'ETF'
    AND prices.latest_price_at >= now() - interval '30 days'
    AND (
      (
        facts.facts_updated_at IS NULL
        AND (
          enrichment.last_attempt_at IS NULL
          OR (enrichment.status = 'error' AND enrichment.last_attempt_at < now() - interval '1 day')
          OR (enrichment.status = 'unavailable' AND enrichment.last_attempt_at < now() - interval '30 days')
        )
      )
      OR (
        facts.facts_updated_at < now() - interval '7 days'
        AND (enrichment.last_attempt_at IS NULL OR enrichment.last_attempt_at < now() - interval '1 day')
      )
    )
  ORDER BY (facts.facts_updated_at IS NULL) DESC,
           (enrichment.last_attempt_at IS NULL) DESC,
           enrichment.last_attempt_at ASC NULLS FIRST,
           prices.latest_price_at DESC,
           c.ticker`;

async function captureQueueSnapshot(pool, phase, intervalStart = null) {
  if (!PHASES.has(phase)) throw new Error(`Tundmatu snapshot phase: ${phase}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const metadata = (await client.query(`SELECT current_database() AS database_name,
      clock_timestamp() AS observed_at,
      (now() AT TIME ZONE 'Europe/Tallinn')::date::text AS tallinn_date`)).rows[0];
    const queueRows = (await client.query(QUEUE_SQL)).rows;
    const attemptsTodayRows = (await client.query(`SELECT status, count(*)::int AS count
      FROM financial_enrichment_status
      WHERE last_attempt_at >= (
        date_trunc('day', now() AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'Europe/Tallinn'
      )
      GROUP BY status`)).rows;
    let intervalRows = [];
    if (intervalStart) {
      intervalRows = (await client.query(`SELECT c.id AS company_id, c.ticker,
          enrichment.status, enrichment.last_attempt_at, enrichment.last_success_at,
          enrichment.consecutive_failures, enrichment.last_error
        FROM financial_enrichment_status enrichment
        JOIN companies c ON c.id = enrichment.company_id
        WHERE enrichment.last_attempt_at > $1::timestamptz
          AND enrichment.last_attempt_at <= $2::timestamptz
        ORDER BY enrichment.last_attempt_at, c.ticker`, [intervalStart, metadata.observed_at])).rows;
    }

    const orderedEligible = queueRows.map((row, index) => ({
      position: index + 1,
      companyId: Number(row.company_id),
      ticker: String(row.ticker),
      eligibilityReason: row.eligibility_reason,
      latestPriceAt: new Date(row.latest_price_at).toISOString(),
      factsUpdatedAt: row.facts_updated_at ? new Date(row.facts_updated_at).toISOString() : null,
      firstObservedAtProxy: new Date(row.created_at).toISOString(),
      firstObservedAgeDays: Number(row.first_observed_age_days),
      enrichment: mapStatus(row),
    }));
    const neverAttempted = orderedEligible.filter((item) => item.enrichment.lastAttemptAt == null);
    const oldestNeverAttempted = neverAttempted
      .slice()
      .sort((a, b) => a.firstObservedAtProxy.localeCompare(b.firstObservedAtProxy) || a.ticker.localeCompare(b.ticker))[0] || null;
    const attemptsToday = { success: 0, unavailable: 0, error: 0, total: 0 };
    for (const row of attemptsTodayRows) {
      if (row.status in attemptsToday) attemptsToday[row.status] = Number(row.count);
      attemptsToday.total += Number(row.count);
    }

    const snapshot = {
      schemaVersion: SCHEMA_VERSION,
      recordType: 'snapshot',
      phase,
      observedAt: new Date(metadata.observed_at).toISOString(),
      tallinnDate: String(metadata.tallinn_date),
      databaseName: String(metadata.database_name),
      queue: {
        eligibleDepth: orderedEligible.length,
        missingFacts: orderedEligible.filter((item) => item.eligibilityReason === 'missing_facts').length,
        staleFacts: orderedEligible.filter((item) => item.eligibilityReason === 'stale_facts').length,
        neverAttempted: neverAttempted.length,
        oldestNeverAttempted: oldestNeverAttempted ? {
          companyId: oldestNeverAttempted.companyId,
          ticker: oldestNeverAttempted.ticker,
          firstObservedAtProxy: oldestNeverAttempted.firstObservedAtProxy,
          ageDays: oldestNeverAttempted.firstObservedAgeDays,
          timestampMeaning: 'companies.created_at proxy for first eligibility',
        } : null,
        orderedEligible,
      },
      attemptsToday,
      intervalAttempts: intervalRows.map((row) => ({
        companyId: Number(row.company_id),
        ticker: String(row.ticker),
        ...mapStatus(row),
      })),
      limitations: [
        'companies.created_at is a proxy for first eligibility, not a persisted eligibility timestamp',
        'financial_enrichment_status stores latest state and consecutive failures, not lifetime per-company attempt count',
      ],
    };
    await client.query('ROLLBACK');
    return snapshot;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function buildObservationReport(before, after, collectorStatus, collectorMode) {
  const beforeIds = new Set(before?.queue?.orderedEligible?.map((item) => item.companyId) || []);
  const afterItems = after?.queue?.orderedEligible || [];
  const remainingEntrants = afterItems.filter((item) => !beforeIds.has(item.companyId));
  const servicedEntrants = (after?.intervalAttempts || []).filter((item) => !beforeIds.has(item.companyId));
  const entrants = new Map();
  for (const item of [...remainingEntrants, ...servicedEntrants]) entrants.set(item.companyId, item.ticker);
  const attempts = { success: 0, unavailable: 0, error: 0, total: 0 };
  for (const item of after?.intervalAttempts || []) {
    if (item.status in attempts) attempts[item.status] += 1;
    attempts.total += 1;
  }
  const exclusionReasons = [];
  if (!before) exclusionReasons.push('missing_before_snapshot');
  if (!after) exclusionReasons.push('missing_after_snapshot');
  if (collectorStatus !== 'success') exclusionReasons.push(`collector_${collectorStatus}`);
  if (collectorMode === 'dry_run') exclusionReasons.push('dry_run');
  const duplicateDayObservation = Boolean(
    before && after && collectorStatus === 'success' && collectorMode === 'live'
    && attempts.total === 0 && before.attemptsToday.total > 0,
  );
  if (duplicateDayObservation) exclusionReasons.push('duplicate_day_no_new_enrichment_attempts');

  return {
    schemaVersion: SCHEMA_VERSION,
    recordType: 'paired_observation',
    observedAt: after?.observedAt || before?.observedAt || new Date().toISOString(),
    tallinnDate: after?.tallinnDate || before?.tallinnDate || null,
    databaseName: after?.databaseName || before?.databaseName || null,
    collector: { status: collectorStatus, mode: collectorMode },
    validity: {
      status: exclusionReasons.length === 0 ? 'valid' : 'partial',
      excludeFromNormalThroughputPercentiles: exclusionReasons.length > 0,
      exclusionReasons,
      duplicateDayObservation,
    },
    before,
    after,
    deltas: {
      eligibleDepth: before && after ? after.queue.eligibleDepth - before.queue.eligibleDepth : null,
      missingFacts: before && after ? after.queue.missingFacts - before.queue.missingFacts : null,
      staleFacts: before && after ? after.queue.staleFacts - before.queue.staleFacts : null,
      neverAttempted: before && after ? after.queue.neverAttempted - before.queue.neverAttempted : null,
      oldestNeverAttemptedAgeDays: before?.queue.oldestNeverAttempted && after?.queue.oldestNeverAttempted
        ? after.queue.oldestNeverAttempted.ageDays - before.queue.oldestNeverAttempted.ageDays
        : null,
    },
    interval: {
      attempts,
      remainingEntrants: remainingEntrants.map(({ companyId, ticker }) => ({ companyId, ticker })),
      entrantAndServicedInSameRun: servicedEntrants.map(({ companyId, ticker }) => ({ companyId, ticker })),
      observedNewEligibleEntrants: [...entrants].map(([companyId, ticker]) => ({ companyId, ticker })),
      derivation: 'union of after-only eligible companies and before-absent companies attempted during the paired window',
    },
  };
}

function renderNdjson(report) {
  return [report.before, report.after, {
    schemaVersion: report.schemaVersion,
    recordType: 'paired_summary',
    observedAt: report.observedAt,
    tallinnDate: report.tallinnDate,
    databaseName: report.databaseName,
    collector: report.collector,
    validity: report.validity,
    deltas: report.deltas,
    interval: report.interval,
  }].filter(Boolean).map((record) => JSON.stringify(record)).join('\n') + '\n';
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const root = repoRoot();
  loadEnv(root);
  const databaseUrl = ensureLocalDatabaseUrl();
  const pool = createObserverPool(databaseUrl);
  let before = null;
  try {
    if (options.before && fs.existsSync(options.before)) {
      before = JSON.parse(fs.readFileSync(options.before, 'utf8'));
    }
    const snapshot = await captureQueueSnapshot(pool, options.phase, before?.observedAt || null);
    const snapshotJson = JSON.stringify(snapshot, null, 2) + '\n';
    if (options.output) writeFile(options.output, snapshotJson);
    else process.stdout.write(snapshotJson);

    if (options.phase === 'after' && (options.report || options.ndjson)) {
      const report = buildObservationReport(before, snapshot, options.collectorStatus, options.collectorMode);
      if (options.report) writeFile(options.report, JSON.stringify(report, null, 2) + '\n');
      if (options.ndjson) writeFile(options.ndjson, renderNdjson(report));
      console.log(`CompanyFacts queue observation: ${report.validity.status}, attempts=${report.interval.attempts.total}, entrants=${report.interval.observedNewEligibleEntrants.length}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('CompanyFacts queue observation failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  SCHEMA_VERSION,
  CONNECTION_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  QUEUE_SQL,
  observerPoolConfig,
  createObserverPool,
  parseArgs,
  captureQueueSnapshot,
  buildObservationReport,
  renderNdjson,
};
