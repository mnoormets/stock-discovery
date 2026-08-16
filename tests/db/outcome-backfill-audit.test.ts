import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { getOutcomeBackfillAudit } from '../../src/lib/outcome-backfill-audit';
import { insertCompany } from '../fixtures/company';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

const NOW = new Date('2026-08-16T12:00:00.000Z');

beforeEach(resetDb);

async function auditFixture() {
  const run = await startCollectionRun('outcome-backfill-audit-test');
  const companyId = await insertCompany('READY');
  const ready = await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'READY',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    companyId,
    growthRank: 1,
    rawSignal: { fixture: true },
  });
  const missing = await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'NOPRICE',
    lookupBucket: 'recall',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: false,
    recallRank: 1,
    rawSignal: { fixture: true },
  });
  await pool.query(
    `UPDATE collection_run_items SET observed_at = '2026-04-01T08:00:00Z'
     WHERE id IN ($1, $2)`,
    [ready.id, missing.id],
  );
  await insertPriceSnapshot(companyId, 100, '2026-03-31T08:00:00Z');
  await insertPriceSnapshot(companyId, 110, '2026-05-01T08:00:00Z');
  await insertPriceSnapshot(companyId, 120, '2026-06-30T08:00:00Z');
  await succeedCollectionRun(run.id);
  return run.id;
}

describe('Outcome Snapshot Backfill Audit V1 read model', () => {
  it('uses only stored price windows and reports readiness per item and run', async () => {
    const runId = await auditFixture();
    const audit = await getOutcomeBackfillAudit(NOW);
    expect(audit.priceTableAvailable).toBe(true);
    expect(audit.summary).toMatchObject({
      totalItems: 2,
      distinctSymbols: 2,
      eligible30dCount: 2,
      eligible90dCount: 2,
      eligible180dCount: 0,
      missingPriceDataCount: 1,
    });
    expect(audit.symbols.find((symbol) => symbol.symbol === 'READY')).toMatchObject({
      hasRequiredPriceData30d: true,
      hasRequiredPriceData90d: true,
      missingReason: 'Eligible for backfill',
    });
    expect(audit.symbols.find((symbol) => symbol.symbol === 'NOPRICE')?.missingReason).toBe('Missing price data');
    expect(audit.runs.find((run) => run.runId === runId)).toMatchObject({
      totalItems: 2,
      eligible30d: 2,
      eligible90d: 2,
      eligible180d: 0,
      missingSnapshots: 4,
      missingPriceData: 2,
    });
  });

  it('enforces read-only behavior across source tables', async () => {
    await auditFixture();
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots`,
    );
    await getOutcomeBackfillAudit(NOW);
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM outcome_analysis_snapshots) AS snapshots`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
