import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getMetadataJoinRootCauseAudit } from '../../src/lib/metadata-join-root-cause';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function rootCauseFixture() {
  const run = await startCollectionRun('metadata-root-cause-test');
  const unlinkedCompanyId = await insertCompany('UNLINKED');
  const blankCompanyId = await insertCompany('BLANKMETA');
  const noScoresCompanyId = await insertCompany('NOSCORES');
  const completeCompanyId = await insertCompany('COMPLETE');
  await pool.query(
    `UPDATE companies
     SET name = NULL, exchange = NULL, quote_type = NULL, currency = NULL,
         source = NULL, sec_cik = NULL, sector = NULL, industry = NULL,
         classification_source = NULL
     WHERE id = $1`,
    [blankCompanyId],
  );
  await pool.query(
    `UPDATE companies
     SET sector = 'Technology', industry = 'Software', exchange = 'NYSE'
     WHERE id = ANY($1::bigint[])`,
    [[noScoresCompanyId, completeCompanyId]],
  );
  await insertPriceSnapshot(noScoresCompanyId, 20, '2026-08-16T20:00:00.000Z', 'fixture');
  await insertPriceSnapshot(completeCompanyId, 30, '2026-08-16T20:00:00.000Z', 'fixture');
  await pool.query(
    `UPDATE price_snapshots
     SET market_cap = CASE WHEN company_id = $1 THEN 500000000 ELSE 1000000000 END
     WHERE company_id = ANY($2::bigint[])`,
    [noScoresCompanyId, [noScoresCompanyId, completeCompanyId]],
  );

  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'UNSELECTED',
    lookupBucket: 'not_selected',
    selectedForMarketData: false,
    marketDataAttempted: false,
    marketDataFound: false,
    skipReason: 'not_selected',
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'NOIDENTITY',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'UNLINKED',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'BLANKMETA',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    companyId: blankCompanyId,
    growthRank: 1,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'NOSCORES',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    companyId: noScoresCompanyId,
    growthRank: 2,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'COMPLETE',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    companyId: completeCompanyId,
    growthRank: 3,
    rawSignal: { fixture: true },
  });
  await succeedCollectionRun(run.id);
  await recordDiscoveryRun(
    ['metadata root cause fixture'],
    [makeDecisionInput({
      companyId: completeCompanyId,
      ticker: 'COMPLETE',
      growthScore: 88,
      healthScore: 72,
      coverageScore: 95,
      marketCap: 1_000_000_000,
      sector: 'Technology',
      industry: 'Software',
    })],
    new Date('2026-08-17T08:00:00.000Z'),
    'rklb_daily',
    run.id,
  );
  return { unlinkedCompanyId };
}

describe('Metadata Join Root Cause Audit V1 read model', () => {
  it('traces identity, item link, metadata, market context, and exact decision scoring', async () => {
    await rootCauseFixture();
    const report = await getMetadataJoinRootCauseAudit(new Date('2026-08-17T12:00:00.000Z'));
    expect(report.summary.totalItems).toBe(6);
    expect(Object.fromEntries(report.items.map((item) => [item.ticker, item.firstFailure]))).toEqual({
      UNSELECTED: 'NOT_SELECTED_FOR_MARKET_DATA',
      NOIDENTITY: 'NO_COMPANY_MATCH',
      UNLINKED: 'COMPANY_MATCH_NOT_LINKED',
      BLANKMETA: 'COMPANY_FOUND_METADATA_MISSING',
      NOSCORES: 'SCORES_MISSING',
      COMPLETE: 'COMPLETE',
    });
    expect(report.items.find((item) => item.ticker === 'UNLINKED')).toMatchObject({
      companyIdentityExists: true,
      companyMatched: false,
      tickerCompanyId: expect.any(Number),
    });
    expect(report.items.find((item) => item.ticker === 'COMPLETE')).toMatchObject({
      companyMatched: true,
      sectorExists: true,
      marketCapExists: true,
      exchangeExists: true,
      scoringDataExists: true,
      finalResearchReady: true,
    });
  });

  it('does not mutate collection, company, price, decision, or score tables', async () => {
    await rootCauseFixture();
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM companies) AS companies,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions,
         (SELECT count(*)::int FROM company_score_snapshots) AS scores`,
    );
    await getMetadataJoinRootCauseAudit();
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM companies) AS companies,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions,
         (SELECT count(*)::int FROM company_score_snapshots) AS scores`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
