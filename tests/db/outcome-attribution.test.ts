import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getOutcomeAttribution } from '../../src/lib/outcome-attribution';
import { recordOutcomeAnalysisSnapshot } from '../../src/lib/outcome-analysis-snapshots';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function createMeasuredSnapshot(index: number, returnPct: number) {
  const ticker = `ATTR${index}`;
  const companyId = await insertCompany(ticker);
  const run = await recordDiscoveryRun(
    ['outcome attribution fixture'],
    [makeDecisionInput({
      companyId,
      ticker,
      growthScore: 85,
      healthScore: 72,
      coverageScore: 90,
      marketCap: 1_000_000_000,
      sector: 'Technology',
    })],
    new Date(`2026-07-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`),
    'rklb_daily',
  );
  const { rows } = await pool.query(
    `SELECT o.id
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     WHERE d.run_id = $1 AND o.horizon = '1w'`,
    [run.runId],
  );
  const outcomeId = Number(rows[0].id);
  await pool.query(
    `UPDATE candidate_outcomes
     SET status = 'measured', return_percent = $2, measured_at = '2026-08-10T08:00:00Z',
         benchmark_status = 'missing'
     WHERE id = $1`,
    [outcomeId, returnPct],
  );
  await recordOutcomeAnalysisSnapshot(outcomeId);
}

describe('Outcome Attribution V1 read model', () => {
  it('aggregates only real immutable outcome snapshots and linked decision signals', async () => {
    const returns = [20, 15, 11, -5, 0, 4];
    for (const [index, returnPct] of returns.entries()) {
      await createMeasuredSnapshot(index, returnPct);
    }

    const report = await getOutcomeAttribution();
    expect(report.sampleCount).toBe(6);
    expect(report.sampleUnit).toBe('measured canonical candidate-horizon outcome');
    expect(report.sections.find((section) => section.key === 'health')?.buckets
      .find((bucket) => bucket.bucket === '60-80')).toMatchObject({
        sampleCount: 6,
        avgReturnPct: 7.5,
        medianReturnPct: 7.5,
        winRatePct: 50,
        loserRatePct: 16.67,
      });
    expect(report.sections.find((section) => section.key === 'sector')?.buckets).toEqual([
      expect.objectContaining({ bucket: 'Technology', sampleCount: 6 }),
    ]);
    expect(report.sections.find((section) => section.key === 'market_cap')?.buckets
      .find((bucket) => bucket.bucket === 'small')?.sampleCount).toBe(6);
  });

  it('is read-only and handles a database with no measured snapshots', async () => {
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions`,
    );
    const report = await getOutcomeAttribution();
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions`,
    );
    expect(report.sampleCount).toBe(0);
    expect(report.highlights).toEqual([]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
