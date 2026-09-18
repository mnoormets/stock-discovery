// SEC Form 4 ingestion. This script does not import collect.ts, discovery.ts,
// scoring or ranking code. Exact ranges remain available for on-demand use;
// the bounded rolling-range flags are used by the scheduled workflow.
//
// Usage: npm run ingest:form4 -- --from 2026-08-19 --to 2026-08-21
//        npm run ingest:form4 -- --recent-days 7 --fail-on-filing-error

const { Pool } = require('pg');
const { ensureLocalDatabaseUrl, loadEnv, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');
const {
  createSecClient,
  indexDatesInRange,
  indexUrl,
  parseFormIndex,
  parseOwnershipSubmission,
} = require('./_form4.cjs');
const {
  markFilingFailure,
  persistForm4Filing,
  recordFilingAttempt,
} = require('./_form4-persistence.cjs');

const INGESTION_LOCK = 'stock-discovery:form4-ingest';
const CONNECTION_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 30_000;

function addDateDays(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function dateInTimeZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function recentCompletedUsDateRange(days, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    throw new Error('--recent-days peab olema täisarv vahemikus 1...31.');
  }
  const todayNewYork = dateInTimeZone(now, 'America/New_York');
  const to = addDateDays(todayNewYork, -1);
  return { from: addDateDays(to, -(days - 1)), to };
}

function ingestionPoolConfig(connectionString) {
  return {
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  };
}

function assertNoFilingFailures(metrics, enabled) {
  if (!enabled) return;
  const failureCount = metrics.fetchFailed + metrics.parseFailed + metrics.persistFailed;
  if (failureCount > 0) throw new Error(`Form 4 ingestion lõpetas ${failureCount} filing-veaga.`);
}

function uniqueIndexRows(rows) {
  return [...new Map(rows.map((row) => [row.accessionNumber, row])).values()];
}

async function registerIndexAttemptsAtomically(pool, rows, recordAttempt = recordFilingAttempt) {
  const client = await pool.connect();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    // Most of the rolling window is already complete. Read those immutable
    // successes once instead of issuing an upsert and SELECT for each filing.
    const persisted = await client.query(
      `SELECT id, accession_number, ingestion_status, ingestion_attempt_count
         FROM insider_filings
        WHERE accession_number = ANY($1::text[]) AND ingestion_status = 'persisted'`,
      [rows.map((row) => row.accessionNumber)],
    );
    const completed = new Map(persisted.rows.map((row) => [row.accession_number, row]));
    const attempts = [];
    for (const row of rows) {
      const existing = completed.get(row.accessionNumber);
      attempts.push({ row, attempt: existing
        ? { ...existing, skipped: true }
        : await recordAttempt(client, row) });
    }
    await client.query('COMMIT');
    began = false;
    return attempts;
  } catch (error) {
    if (began) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function parseArgs(argv, now = new Date()) {
  const options = { from: null, to: null, recentDays: null, failOnFilingError: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--from') { options.from = value; index += 1; }
    else if (arg === '--to') { options.to = value; index += 1; }
    else if (arg === '--recent-days') { options.recentDays = Number(value); index += 1; }
    else if (arg === '--fail-on-filing-error') options.failOnFilingError = true;
    else throw new Error(`Tundmatu argument: ${arg}`);
  }
  if (options.recentDays != null) {
    if (options.from || options.to) throw new Error('--recent-days ja explicit --from/--to ei tohi olla koos.');
    return {
      ...recentCompletedUsDateRange(options.recentDays, now),
      failOnFilingError: options.failOnFilingError,
      newestFirst: true,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(options.to || '')) {
    throw new Error('--from ja --to on kohustuslikud kujul YYYY-MM-DD.');
  }
  const fromTime = Date.parse(`${options.from}T00:00:00Z`);
  const toTime = Date.parse(`${options.to}T00:00:00Z`);
  const canonicalFrom = Number.isFinite(fromTime) ? new Date(fromTime).toISOString().slice(0, 10) : null;
  const canonicalTo = Number.isFinite(toTime) ? new Date(toTime).toISOString().slice(0, 10) : null;
  if (canonicalFrom !== options.from || canonicalTo !== options.to || options.from > options.to) {
    throw new Error('Form 4 kuupäevavahemik on vigane.');
  }
  const calendarDays = Math.floor((toTime - fromTime) / 86_400_000) + 1;
  if (calendarDays > 31) throw new Error('Form 4 ingestion on piiratud 31 kalendripäevaga ühe jooksu kohta.');
  return {
    from: options.from,
    to: options.to,
    failOnFilingError: options.failOnFilingError,
    newestFirst: false,
  };
}

async function ingestDateRange({ pool, sec, from, to, newestFirst = false, log = console.log }) {
  const availableDates = await indexDatesInRange(sec, from, to);
  const dates = newestFirst ? [...availableDates].reverse() : availableDates;
  const metrics = {
    dates,
    indexed: 0,
    distinctAccessions: 0,
    persisted: 0,
    skipped: 0,
    fetchFailed: 0,
    parseFailed: 0,
    persistFailed: 0,
    owners: 0,
    transactions: 0,
    footnotes: 0,
  };
  for (const date of dates) {
    const rows = parseFormIndex(await sec.text(indexUrl(date)));
    const distinctRows = uniqueIndexRows(rows);
    metrics.indexed += rows.length;
    metrics.distinctAccessions += distinctRows.length;
    log(`${date}: ${rows.length} Form 4/4A indeksirida; ${distinctRows.length} unikaalset accession'it`);
    const prepared = await registerIndexAttemptsAtomically(pool, distinctRows);
    for (const [position, { row: indexRow, attempt }] of prepared.entries()) {
      if (attempt.skipped) {
        metrics.skipped += 1;
        continue;
      }
      let submission;
      try {
        submission = await sec.text(indexRow.url);
      } catch (error) {
        await markFilingFailure(pool, indexRow.accessionNumber, 'fetch_failed', error);
        metrics.fetchFailed += 1;
        continue;
      }
      let parsed;
      try {
        parsed = parseOwnershipSubmission(submission, indexRow);
      } catch (error) {
        await markFilingFailure(pool, indexRow.accessionNumber, 'parse_failed', error);
        metrics.parseFailed += 1;
        continue;
      }
      try {
        const result = await persistForm4Filing(pool, indexRow, parsed);
        if (result.skipped) metrics.skipped += 1;
        else {
          metrics.persisted += 1;
          metrics.owners += result.ownerCount;
          metrics.transactions += result.transactionCount;
          metrics.footnotes += result.footnoteCount;
        }
      } catch (error) {
        await markFilingFailure(pool, indexRow.accessionNumber, 'persist_failed', error);
        metrics.persistFailed += 1;
      }
      if ((position + 1) % 50 === 0 || position + 1 === prepared.length) {
        log(`  ${position + 1}/${prepared.length}; persisted ${metrics.persisted}; skipped ${metrics.skipped}; failures ${metrics.fetchFailed + metrics.parseFailed + metrics.persistFailed}`);
      }
    }
  }
  return metrics;
}

async function main(argv = process.argv.slice(2)) {
  const root = repoRoot();
  registerRepoModules(root);
  loadEnv(root);
  ensureLocalDatabaseUrl();
  if (!process.env.SEC_USER_AGENT) throw new Error('SEC_USER_AGENT puudub.');
  const options = parseArgs(argv);
  const pool = new Pool(ingestionPoolConfig(process.env.DATABASE_URL));
  const lockClient = await pool.connect();
  let locked = false;
  try {
    const lockResult = await lockClient.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
      [INGESTION_LOCK],
    );
    locked = Boolean(lockResult.rows[0].locked);
    if (!locked) throw new Error('Teine Form 4 ingestion hoiab advisory locki.');
    const sec = createSecClient(process.env.SEC_USER_AGENT);
    console.log('=== SEC Form 4 on-demand ingestion ===');
    console.log(`Range: ${options.from} .. ${options.to}`);
    console.log('SEC pacing: sequential, >=200 ms between request starts (<=5 req/s), 10 s timeout');
    console.log('Pipeline isolation: no collect/discovery/scoring/ranking integration');
    const metrics = await ingestDateRange({ pool, sec, ...options });
    console.log(JSON.stringify({ ...metrics, secRequests: sec.requestCount }, null, 2));
    assertNoFilingFailures(metrics, options.failOnFilingError);
    return metrics;
  } finally {
    if (locked) await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [INGESTION_LOCK]);
    lockClient.release();
    await pool.end();
  }
}

module.exports = {
  CONNECTION_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  assertNoFilingFailures,
  ingestDateRange,
  ingestionPoolConfig,
  parseArgs,
  recentCompletedUsDateRange,
  registerIndexAttemptsAtomically,
  uniqueIndexRows,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`FORM 4 INGESTION FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
