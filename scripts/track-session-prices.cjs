// Research quotes only. No paper executor, signal writer or broker call.
const path = require('node:path');
const { loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');
const root = repoRoot(); registerRepoModules(root); loadEnv(root); ensureLocalDatabaseUrl();
const { pool } = loadTs(path.join(root, 'src/lib/db.ts'));
const { isExpectedNewYorkRegularSession } = loadTs(path.join(root, 'src/lib/price-observation.ts'));
const { collectTrackedPrices, priceTrackingHasErrors } = loadTs(path.join(root, 'src/lib/price-tracking.ts'));
(async () => {
  const now = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if (!isExpectedNewYorkRegularSession(now)) {
    console.log(JSON.stringify({ skipped: 'outside regular session' })); return;
  }
  const result = await collectTrackedPrices();
  console.log(JSON.stringify(result));
  if (priceTrackingHasErrors(result)) throw new Error('Regular-session research quote coverage incomplete.');
})().catch(() => { console.error('Session research capture failed; inspect tracking status.'); process.exitCode = 1; })
  .finally(() => pool.end());
