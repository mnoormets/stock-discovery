// Eligibility report: kas canonical collect on jooksnud ja kas outcome-ahel
// saab tööle. AINULT LUGEMINE — ei kirjuta ühtegi rida, ei muuda skeemi.
//
// Kasutus:  npm run collect:status

const path = require('node:path');
const { loadTs, loadEnv, ensureLocalDatabaseUrl, repoRoot, registerRepoModules } = require('./_ts-loader.cjs');

const root = repoRoot();
registerRepoModules(root);
loadEnv(root);
const databaseUrl = ensureLocalDatabaseUrl();

const { pool } = loadTs(path.join(root, 'src/lib/db.ts'));

function line(label, value, note = '') {
  console.log(`  ${String(label).padEnd(38)} ${String(value).padStart(10)}${note ? '   ' + note : ''}`);
}

async function main() {
  console.log('=== Stock Discovery · collect status (read-only) ===');
  console.log(`  DB: ${databaseUrl.replace(/\/\/[^@]*@/, '//***@')}`);

  const m = (await pool.query(`
    SELECT
      (SELECT count(*) FROM discovery_runs)::int AS runs_total,
      (SELECT count(*) FROM discovery_runs WHERE run_type='rklb_daily')::int AS canonical_runs,
      (SELECT count(*) FROM discovery_runs WHERE run_type<>'rklb_daily')::int AS manual_runs,
      (SELECT count(*) FROM discovery_decisions)::int AS decisions_total,
      (SELECT count(*) FROM discovery_decisions WHERE included)::int AS decisions_included,
      (SELECT count(*) FROM discovery_decisions d WHERE d.included
         AND NOT EXISTS (SELECT 1 FROM candidate_outcomes o WHERE o.decision_id=d.id))::int AS included_without_outcomes,
      (SELECT count(*) FROM candidate_outcomes)::int AS outcomes_total,
      (SELECT count(*) FROM candidate_outcomes WHERE status='pending')::int AS outcomes_pending,
      (SELECT count(*) FROM candidate_outcomes WHERE status<>'measured' AND target_at <= now())::int AS outcomes_measurable,
      (SELECT count(*) FROM candidate_outcomes WHERE status='measured')::int AS outcomes_measured,
      (SELECT count(*) FROM candidate_outcomes WHERE status='missing')::int AS outcomes_missing,
      (SELECT count(*) FROM price_snapshots)::int AS price_snapshots,
      (SELECT count(*) FROM price_snapshots p JOIN companies c ON c.id=p.company_id WHERE c.ticker='SPY')::int AS spy_snapshots,
      (SELECT count(*) FROM company_score_snapshots)::int AS score_snapshots,
      (SELECT count(*) FROM financial_enrichment_status)::int AS enrichment_rows,
      (SELECT count(DISTINCT company_id) FROM financial_facts)::int AS companies_with_facts,
      (SELECT count(*) FROM companies)::int AS companies_total,
      (now() AT TIME ZONE 'Europe/Tallinn')::date::text AS tallinn_today,
      EXISTS (SELECT 1 FROM discovery_runs WHERE run_type='rklb_daily'
              AND decision_date = (now() AT TIME ZONE 'Europe/Tallinn')::date) AS today_canonical
  `)).rows[0];

  const latest = (await pool.query(`
    SELECT id, model_version, decision_date::text AS decision_date, to_char(run_at,'YYYY-MM-DD HH24:MI') AS run_at,
           evaluated_count, included_count
    FROM discovery_runs WHERE run_type='rklb_daily'
    ORDER BY decision_date DESC, id DESC LIMIT 1`)).rows[0] || null;

  console.log('\n-- Discovery runs --');
  line('discovery_runs total', m.runs_total);
  line('canonical runs (rklb_daily)', m.canonical_runs, m.canonical_runs === 0 ? '<-- canonical pole kunagi jooksnud' : '');
  line('manual runs', m.manual_runs);
  line('latest canonical run', latest ? `#${latest.id}` : '-',
    latest ? `${latest.decision_date} · ${latest.model_version} · ${latest.included_count}/${latest.evaluated_count} included` : 'puudub');
  line('Tallinn today', m.tallinn_today);
  line('today canonical exists?', m.today_canonical ? 'JAH' : 'EI');

  console.log('\n-- Decisions --');
  line('discovery_decisions total', m.decisions_total);
  line('included decisions', m.decisions_included);
  line('included WITHOUT outcomes', m.included_without_outcomes);

  console.log('\n-- Outcomes --');
  line('candidate_outcomes total', m.outcomes_total);
  line('pending', m.outcomes_pending);
  line('measurable (target_at kaes)', m.outcomes_measurable);
  line('measured', m.outcomes_measured);
  line('missing', m.outcomes_missing);

  console.log('\n-- Sisendid --');
  line('price_snapshots total', m.price_snapshots);
  line('SPY price snapshots', m.spy_snapshots, m.spy_snapshots < 2 ? '<-- benchmark ajalugu on ohuke' : '');
  line('company_score_snapshots', m.score_snapshots);
  line('financial_enrichment_status rows', m.enrichment_rows, m.enrichment_rows === 0 ? '<-- SEC enrichment pole jooksnud' : '');
  line('companies with SEC facts', `${m.companies_with_facts}/${m.companies_total}`);

  const detail = await pool.query(`
    SELECT d.ticker, d.run_id, r.run_type, r.decision_date::text AS as_of_date, d.decision_price,
           (d.score_snapshot_id IS NOT NULL) AS has_score_snapshot,
           CASE
             WHEN r.run_type <> 'rklb_daily' THEN 'manual run - outcome loomine on disaini jargi valistatud'
             WHEN d.decision_price IS NULL THEN 'decision_price puudub - outcome ei saa baseline i'
             ELSE 'canonical run, kuid outcome read puuduvad (ootamatu)'
           END AS reason_outcome_missing
    FROM discovery_decisions d
    JOIN discovery_runs r ON r.id = d.run_id
    WHERE d.included AND NOT EXISTS (SELECT 1 FROM candidate_outcomes o WHERE o.decision_id=d.id)
    ORDER BY r.decision_date DESC, d.ticker`);

  console.log('\n-- Included otsused ILMA outcome ta --');
  if (detail.rowCount === 0) {
    console.log('  (puuduvaid ei ole)');
  } else {
    console.log('  Ticker | run_id | run_type   | as_of_date | decision_price | score_snap | reason');
    for (const r of detail.rows) {
      console.log(`  ${String(r.ticker).padEnd(6)} | ${String(r.run_id).padStart(6)} | ${String(r.run_type).padEnd(10)} | ${String(r.as_of_date).slice(0, 10)} | ${String(r.decision_price ?? '-').padStart(14)} | ${r.has_score_snapshot ? 'jah'.padStart(10) : 'ei'.padStart(10)} | ${r.reason_outcome_missing}`);
    }
  }
  console.log('');
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('collect:status ebaonnestus:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
