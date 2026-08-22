// On-demand SEC Form 4 ingestion. This script is not scheduled and does not
// import collect.ts, discovery.ts, scoring or ranking code.
//
// Usage: npm run ingest:form4 -- --from 2026-08-19 --to 2026-08-21

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

function parseArgs(argv) {
  const options = { from: null, to: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--from') { options.from = value; index += 1; }
    else if (arg === '--to') { options.to = value; index += 1; }
    else throw new Error(`Tundmatu argument: ${arg}`);
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
  return options;
}

async function ingestDateRange({ pool, sec, from, to, log = console.log }) {
  const dates = await indexDatesInRange(sec, from, to);
  const metrics = {
    dates,
    indexed: 0,
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
    metrics.indexed += rows.length;
    log(`${date}: ${rows.length} Form 4/4A filingut`);
    for (const [position, indexRow] of rows.entries()) {
      const attempt = await recordFilingAttempt(pool, indexRow);
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
      if ((position + 1) % 50 === 0 || position + 1 === rows.length) {
        log(`  ${position + 1}/${rows.length}; persisted ${metrics.persisted}; skipped ${metrics.skipped}; failures ${metrics.fetchFailed + metrics.parseFailed + metrics.persistFailed}`);
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
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
    return metrics;
  } finally {
    if (locked) await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [INGESTION_LOCK]);
    lockClient.release();
    await pool.end();
  }
}

module.exports = { ingestDateRange, parseArgs };

if (require.main === module) {
  main().catch((error) => {
    console.error(`FORM 4 INGESTION FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
