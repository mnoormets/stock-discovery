// Lokaalne paevane collect. Orkestreerib TAPSELT sama ahela nagu /api/collect,
// kutsudes olemasolevaid funktsioone — arilogikat siin ei dubleerita ega muudeta.
//
// Kasutus:
//   npm run collect:daily
//   npm run collect:daily -- --dry-run
//
// Kogu job on kaitstud Postgres advisory lockiga (session-level), et kaks
// samaaegset collecti ei saaks joosta. Lock hoitakse UHE pühendatud kliendi
// peal ja vabastatakse alati (finally).

const path = require('node:path');
const { loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');
const { sendHealthchecksPingIfComplete } = require('./_healthchecks.cjs');

const root = repoRoot();
registerRepoModules(root);
loadEnv(root);
const databaseUrl = ensureLocalDatabaseUrl();

const DRY_RUN = process.argv.includes('--dry-run');

const { pool } = loadTs(path.join(root, 'src/lib/db.ts'));
const { COLLECTION_ADVISORY_LOCK_NAME: LOCK_NAME } = loadTs(path.join(root, 'src/lib/collection-lock.ts'));

function section(title) { console.log(`\n-- ${title} --`); }
function line(label, value, note = '') {
  console.log(`  ${String(label).padEnd(34)} ${String(value).padStart(10)}${note ? '   ' + note : ''}`);
}

async function counters() {
  return (await pool.query(`
    SELECT
      (SELECT count(*) FROM discovery_runs)::int AS runs,
      (SELECT count(*) FROM discovery_runs WHERE run_type='rklb_daily')::int AS canonical,
      (SELECT count(*) FROM discovery_decisions)::int AS decisions,
      (SELECT count(*) FROM candidate_outcomes)::int AS outcomes,
      (SELECT count(*) FROM price_snapshots)::int AS prices,
      (SELECT count(*) FROM price_snapshots p JOIN companies c ON c.id=p.company_id WHERE c.ticker='SPY')::int AS spy,
      (SELECT count(*) FROM financial_enrichment_status)::int AS enrichment,
      (SELECT count(DISTINCT company_id) FROM financial_facts)::int AS with_facts,
      (now() AT TIME ZONE 'Europe/Tallinn')::date::text AS tallinn_today,
      EXISTS (SELECT 1 FROM discovery_runs WHERE run_type='rklb_daily'
              AND decision_date=(now() AT TIME ZONE 'Europe/Tallinn')::date) AS today_canonical
  `)).rows[0];
}

async function main() {
  console.log(`=== Stock Discovery · daily collect${DRY_RUN ? ' (DRY RUN)' : ''} ===`);
  console.log(`  DB: ${databaseUrl.replace(/\/\/[^@]*@/, '//***@')}`);

  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
    locked = lock.rows[0].ok === true;
    if (!locked) {
      console.log('\n  TEINE COLLECT JOOKSEB JUBA (advisory lock on voetud). Katkestan puhtalt.');
      return 0;
    }

    // ---------- Preflight ----------
    section('Preflight');
    const before = await counters();
    line('DB uhendus', 'OK');
    line('SEC_USER_AGENT', process.env.SEC_USER_AGENT ? 'olemas' : 'PUUDUB',
      process.env.SEC_USER_AGENT ? '' : '<-- SEC enrichment jaab vahele');
    line('FMP_API_KEY', process.env.FMP_API_KEY ? 'olemas' : 'puudub', '(valikuline varutee)');
    line('Tallinn today', before.tallinn_today);
    line('today canonical exists?', before.today_canonical ? 'JAH' : 'EI',
      before.today_canonical ? '(kordusjooks ei loo teist)' : '');
    line('canonical runs (enne)', before.canonical);
    line('candidate_outcomes (enne)', before.outcomes);

    if (DRY_RUN) {
      // Konservatiivne dry-run: EI kutsuta uhtegi kirjutavat funktsiooni.
      // Ainult preflight + plaan, et mitte kirjutada snapshots/facts/runs ridu.
      section('Plaan (dry-run ei kirjuta midagi)');
      console.log('  1. runCollection()                 -> snapshots, companies, price_snapshots');
      console.log('  2. collectDefaultBenchmarkPrice()  -> SPY hinnasnapshot (benchmark baseline)');
      console.log('  3. enrichStoredCompanyFinancials() -> kuni 20 ettevotet/Tallinna paev -> financial_facts');
      console.log('  4. enrichCompanyClassifications()  -> companies.sector/industry');
      console.log(`  5. getRklbDiscoveryCandidates({runType:'rklb_daily', collectionRunId}) -> ${before.today_canonical ? 'taaskasutab tanast canonical run i' : 'LOOB tanase canonical run i'}`);
      console.log('  5b. recordPaperStrategySignals()   -> salvestab ainult versioned paper-policy intents (kui 0008 on rakendatud)');
      console.log('  5c. collectTrackedPrices()        -> bounded Yahoo follow-up prices, separate tracking provenance (0009 required)');
      console.log('  6. refreshCandidateOutcomes()      -> moodab outcome id, mille target_at on kaes');
      console.log('\n  Dry-run ei kutsunud uhtegi kirjutavat funktsiooni. Ridu ei lisatud.');
      return 0;
    }

    // ---------- Paris jooks: sama jarjekord nagu /api/collect ----------
    const errors = [];
    const step = async (name, fn) => {
      try { return await fn(); }
      catch (error) { errors.push(`${name}: ${error.message}`); console.error(`  ! ${name} ebaonnestus:`, error.message); return null; }
    };

    const collect = loadTs(path.join(root, 'src/lib/collect.ts'));
    const backtest = loadTs(path.join(root, 'src/lib/backtest.ts'));
    const financials = loadTs(path.join(root, 'src/lib/company-financials.ts'));
    const classification = loadTs(path.join(root, 'src/lib/company-classification.ts'));
    const discovery = loadTs(path.join(root, 'src/lib/rklb-discovery.ts'));
    const validation = loadTs(path.join(root, 'src/lib/discovery-validation.ts'));
    const paperStrategy = loadTs(path.join(root, 'src/lib/paper-strategy-store.ts'));
    const priceTracking = loadTs(path.join(root, 'src/lib/price-tracking.ts'));

    const { MARKET_FINANCIAL_ENRICHMENT_LIMIT } = loadTs(path.join(root, 'src/lib/market-radar.ts'));
    section('1. runCollection');
    const collected = await step('runCollection', () => collect.runCollection());
    if (collected) {
      line('collectionRunId', `#${collected.collectionRunId}`);
      line('captureDate', collected.captureDate);
      line('scanned', collected.scanned);
      line('candidates', collected.candidates);
      line('liveDataSaved', collected.liveDataSaved);
      line('market radar stocks', collected.marketRadar.stocks.length);
      await step('market radar coverage', async () => {
        const failed = collected.marketRadar.channels.filter((channel) => channel.status !== 'ok');
        if (failed.length) throw new Error('Market radar channels failed: ' + failed.map((channel) => channel.id).join(', '));
        return true;
      });
    }

    section('2. benchmark (SPY)');
    const benchmark = await step('collectDefaultBenchmarkPrice', () => backtest.collectDefaultBenchmarkPrice());
    line('benchmarkCaptured', benchmark === true ? 'JAH' : 'EI');

    section('3. SEC enrichment');
    const sec = await step('enrichStoredCompanyFinancials', () => financials.enrichStoredCompanyFinancials(MARKET_FINANCIAL_ENRICHMENT_LIMIT));
    if (sec) {
      line('status', sec.status);
      line('attempted', sec.attempted);
      line('enriched', sec.enriched);
      line('unavailable', sec.unavailable);
      line('failed', sec.failed);
      line('coveredBefore -> After', `${sec.coveredBefore} -> ${sec.coveredAfter}`);
      line('dailyRemaining', sec.dailyRemaining);
    }

    section('4. classification enrichment');
    const cls = await step('enrichCompanyClassifications', () => classification.enrichCompanyClassifications());
    if (cls) {
      line('attempted', cls.attempted);
      line('enriched', cls.enriched);
      line('unavailable', cls.unavailable);
      line('failed', cls.failed);
      line('remaining', cls.remaining);
    }

    const outcomesBeforeDiscovery = (await counters()).outcomes;

    section('5. canonical discovery');
    const run = await step('getRklbDiscoveryCandidates', () => discovery.getRklbDiscoveryCandidates({
      runType: 'rklb_daily',
      collectionRunId: collected?.collectionRunId ?? null,
    }));
    if (run) {
      line('runId', `#${run.runId}`);
      line('runReused', run.runReused ? 'JAH' : 'EI', run.runReused ? '(sama Tallinna paev)' : '(uus canonical snapshot)');
      line('evaluated', run.recordedEvaluatedCompanies);
      line('included', run.recordedCandidateCount);
      line('excluded', Math.max(0, run.recordedEvaluatedCompanies - run.recordedCandidateCount));
      line('inputChangedAfterSnapshot', run.inputChangedAfterCanonicalSnapshot ? 'JAH' : 'EI');
    }
    const outcomesAfterDiscovery = (await counters()).outcomes;
    line('created candidate_outcomes', outcomesAfterDiscovery - outcomesBeforeDiscovery);

    section('5b. paper strategy signals');
    if (!run) {
      line('status', 'SKIPPED', '(canonical run puudub)');
    } else if (!(await paperStrategy.paperStrategySchemaAvailable())) {
      line('status', 'SKIPPED', '(migration 0008 pole rakendatud)');
    } else {
      try {
        const paper = await paperStrategy.recordPaperStrategySignals(run.runId);
        line('runId', `#${paper.runId}`);
        line('decisions', paper.decisions);
        line('inserted orders', paper.insertedOrders);
        line('existing orders', paper.existingOrders);
        line('pending / skipped', `${paper.pendingOrders} / ${paper.skippedOrders}`);
        line('exit orders', paper.insertedExitOrders);
      } catch (error) {
        // Paper mõõtmise tõrge ei tohi muuta edukat collection/discovery jooksu
        // ebaõnnestunuks ega takistada Healthchecks heartbeat'i.
        console.warn(`  ! paper-strategy signalid jäid salvestamata: ${error.message}`);
      }
    }

    section('5c. continued price tracking');
    const tracked = await step('collectTrackedPrices', () => priceTracking.collectTrackedPrices());
    if (tracked) {
      line('tracking', JSON.stringify(tracked));
      if (tracked.failed || tracked.missing || tracked.invalid || tracked.stale || tracked.deferred) {
        errors.push('Price tracking incomplete; inspect price_tracking_attempts.');
      }
    }

    section('6. refreshCandidateOutcomes');
    const refreshed = await step('refreshCandidateOutcomes', () => validation.refreshCandidateOutcomes());
    line('refreshed rows', refreshed == null ? '-' : refreshed);

    // ---------- Kokkuvote ----------
    const after = await counters();
    section('Kokkuvote (enne -> parast)');
    const rows = [
      ['canonical_runs', before.canonical, after.canonical],
      ['discovery_runs total', before.runs, after.runs],
      ['discovery_decisions', before.decisions, after.decisions],
      ['candidate_outcomes', before.outcomes, after.outcomes],
      ['price_snapshots', before.prices, after.prices],
      ['SPY snapshots', before.spy, after.spy],
      ['financial_enrichment_status', before.enrichment, after.enrichment],
      ['companies with SEC facts', before.with_facts, after.with_facts],
    ];
    for (const [label, b, a] of rows) {
      console.log(`  ${label.padEnd(30)} ${String(b).padStart(6)} -> ${String(a).padStart(6)}${a !== b ? '  (+' + (a - b) + ')' : ''}`);
    }
    if (errors.length) {
      section('Vead (job ei katkenud)');
      for (const e of errors) console.log(`  ! ${e}`);
    }

    const heartbeat = await sendHealthchecksPingIfComplete({
      url: process.env.HEALTHCHECKS_PING_URL,
      dryRun: DRY_RUN,
      errors,
      canonicalRun: run,
      todayCanonical: after.today_canonical,
    });
    if (heartbeat.status !== 'skipped') {
      section('Healthchecks heartbeat');
      line('status', heartbeat.status === 'sent' ? `SENT (HTTP ${heartbeat.httpStatus})` : heartbeat.status);
    }
    return errors.length ? 1 : 0;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

main()
  .then((code) => { console.log(''); process.exit(code || 0); })
  .catch((error) => { console.error('collect:daily ebaonnestus:', error); process.exit(1); });
