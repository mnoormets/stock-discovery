import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getOutcomeCoverage } from '../../src/lib/outcome-coverage';
import { recordOutcomeAnalysisSnapshot } from '../../src/lib/outcome-analysis-snapshots';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function coverageFixture() {
  const collection = await startCollectionRun('outcome-coverage-test');
  const companyId = await insertCompany('COVA');
  await recordCollectionRunItem({
    collectionRunId: collection.id,
    ticker: 'COVA',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    companyId,
    growthRank: 1,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: collection.id,
    ticker: 'MISS',
    lookupBucket: 'recall',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: false,
    recallRank: 1,
    rawSignal: { fixture: true },
  });
  await succeedCollectionRun(collection.id);

  const discovery = await recordDiscoveryRun(
    ['outcome coverage fixture'],
    [makeDecisionInput({ companyId, ticker: 'COVA' })],
    new Date('2026-08-01T08:00:00.000Z'),
    'rklb_daily',
    collection.id,
  );
  const { rows: outcomes } = await pool.query(
    `SELECT o.id
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     WHERE d.run_id = $1 AND o.horizon IN ('1w', '2w')
     ORDER BY o.horizon`,
    [discovery.runId],
  );
  for (const outcome of outcomes) {
    await pool.query(
      `UPDATE candidate_outcomes
       SET status = 'measured', return_percent = 12, measured_at = '2026-08-15T08:00:00Z',
           benchmark_status = 'missing'
       WHERE id = $1`,
      [outcome.id],
    );
    await recordOutcomeAnalysisSnapshot(Number(outcome.id));
  }
  return collection.id;
}

describe('Outcome Coverage V1 read model', () => {
  it('derives real totals from collection items and deduplicates multiple outcome horizons', async () => {
    const runId = await coverageFixture();
    const report = await getOutcomeCoverage(new Date('2026-08-16T12:00:00.000Z'));
    expect(report.summary).toEqual({
      totalCandidates: 2,
      measuredCandidates: 1,
      missingOutcomes: 1,
      coveragePct: 50,
    });
    expect(report.byRun.find((run) => run.runId === runId)).toMatchObject({
      candidateCount: 2,
      measuredCount: 1,
      missingCount: 1,
      coveragePct: 50,
    });
  });

  it('is read-only across all participating tables', async () => {
    await coverageFixture();
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_runs) AS runs,
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots`,
    );
    await getOutcomeCoverage();
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_runs) AS runs,
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('handles an empty database without invented coverage', async () => {
    const report = await getOutcomeCoverage();
    expect(report.summary.coveragePct).toBeNull();
    expect(report.summary.totalCandidates).toBe(0);
    expect(report.byRun).toEqual([]);
    expect(report.highlights).toEqual([]);
  });
});
