import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getMetadataCoverageAudit } from '../../src/lib/metadata-coverage-audit';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function metadataFixture() {
  const run = await startCollectionRun('metadata-coverage-test');
  const companyId = await insertCompany('META');
  await pool.query(
    `UPDATE companies
     SET name = 'Metadata Corp', sector = 'Technology', industry = 'Software',
         exchange = 'NYSE', quote_type = 'EQUITY', currency = 'USD',
         source = 'fixture', sec_cik = '0000123456', classification_source = 'yahoo'
     WHERE id = $1`,
    [companyId],
  );
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'META',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    companyId,
    mentionCount: 10,
    growthRank: 1,
    rawSignal: { fixture: true },
  });
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'MISSING',
    lookupBucket: 'not_selected',
    selectedForMarketData: false,
    marketDataAttempted: false,
    marketDataFound: false,
    rawSignal: { fixture: true },
  });
  await succeedCollectionRun(run.id);
  await recordDiscoveryRun(
    ['metadata coverage fixture'],
    [makeDecisionInput({
      companyId,
      ticker: 'META',
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
}

describe('Metadata Coverage Audit V1 read model', () => {
  it('uses actual schema fields, linked decision metadata, and auto-discovered collection/company fields', async () => {
    await metadataFixture();
    const report = await getMetadataCoverageAudit(new Date('2026-08-17T12:00:00.000Z'));
    expect(report.summary.totalItems).toBe(2);
    expect(report.fields.find((entry) => entry.key === 'sector')).toMatchObject({
      schemaAvailable: true,
      populatedCount: 1,
      missingCount: 1,
      coveragePct: 50,
    });
    expect(report.fields.find((entry) => entry.key === 'growth_score')).toMatchObject({
      populatedCount: 1,
      missingCount: 1,
    });
    expect(report.fields.find((entry) => entry.key === 'country')).toMatchObject({
      schemaAvailable: false,
      populatedCount: 0,
      missingCount: 2,
    });
    expect(report.fields.find((entry) => entry.key === 'total_score')?.schemaAvailable).toBe(false);
    expect(report.fields.find((entry) => entry.key === 'companies.quote_type')).toMatchObject({
      autoDiscovered: true,
      populatedCount: 1,
    });
    expect(report.fields.find((entry) => entry.key === 'collection_run_items.market_data_found')).toMatchObject({
      populatedCount: 2,
      distinctValueCount: 2,
    });
  });

  it('does not mutate any participating source table', async () => {
    await metadataFixture();
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM companies) AS companies,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions,
         (SELECT count(*)::int FROM company_score_snapshots) AS scores`,
    );
    await getMetadataCoverageAudit();
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
