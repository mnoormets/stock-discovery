// Paper-strategy runner. This never talks to a broker. It either freezes
// signals from an existing canonical run or fills pending hypothetical orders
// from a fresh Yahoo REGULAR-session quote.

const path = require('node:path');
const { loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');

const root = repoRoot();
registerRepoModules(root);
loadEnv(root);
ensureLocalDatabaseUrl();

const { pool } = loadTs(path.join(root, 'src/lib/db.ts'));
const store = loadTs(path.join(root, 'src/lib/paper-strategy-store.ts'));
const capital = loadTs(path.join(root, 'src/lib/paper-capital.ts'));
const policy = loadTs(path.join(root, 'src/lib/paper-strategy.ts'));

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function latestCanonicalRunId() {
  const { rows } = await pool.query(
    `SELECT id FROM discovery_runs
     WHERE run_type = 'rklb_daily'
     ORDER BY decision_date DESC, run_at DESC, id DESC LIMIT 1`,
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function main() {
  if (!(await store.paperStrategySchemaAvailable())) {
    throw new Error('paper_strategy_orders table is missing; apply migration 0008 first.');
  }
  const command = process.argv[2];
  if (command === 'signal') {
    const requested = argument('--run-id');
    const runId = requested == null ? await latestCanonicalRunId() : Number(requested);
    if (!Number.isInteger(runId) || runId <= 0) throw new Error('No canonical run was found.');
    console.log(JSON.stringify(await store.recordPaperStrategySignals(runId), null, 2));
    return;
  }
  if (command === 'execute') {
    const now = new Date();
    const capitalResult = await capital.executeCapitalPaper({ now });
    console.log(JSON.stringify({ capital: capitalResult }, null, 2));
    const result = await store.executePendingPaperOrders({ now });
    console.log(JSON.stringify(result, null, 2));
    if (policy.shouldFailIncompletePaperExecution(result.deferredOrders, result.unmarkedHeldTickers.length, now)) {
      throw new Error(`${result.deferredOrders} hypothetical paper orders deferred; ${result.unmarkedHeldTickers.length} held tickers without fresh marks (${result.unmarkedHeldTickers.join(", ") || "none"}) during the expected New York regular session.`);
    }
    if (policy.shouldFailIncompletePaperExecution(0, capitalResult.issues.length, now)) {
      throw new Error('Capital paper quote coverage incomplete: ' + capitalResult.issues.join('; '));
    }
    return;
  }
  throw new Error('Usage: npm run paper:strategy -- signal [--run-id N] | execute');
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    await pool.end().catch(() => {});
    process.exit(1);
  });
