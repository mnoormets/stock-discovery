import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { getDiscoveryQualityAudit } from '../../src/lib/discovery-quality-audit';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function qualityFixture() {
  const run = await startCollectionRun('discovery-quality-test');
  const companyId = await insertCompany('QUAL');
  await pool.query(
    `UPDATE companies SET sector = 'Technology', industry = 'Software', exchange = 'NMS'
     WHERE id = $1`,
    [companyId],
  );
  await insertPriceSnapshot(companyId, 50, '2026-08-01T07:00:00Z', 'fixture');
  await recordCollectionRunItem({
    collectionRunId: run.id,
    ticker: 'QUAL',
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
    collectionRunId: run.id,
    ticker: 'UNKNOWN',
    lookupBucket: 'not_selected',
    selectedForMarketData: false,
    marketDataAttempted: false,
    marketDataFound: false,
    rawSignal: { fixture: true },
  });
  await succeedCollectionRun(run.id);
  await recordDiscoveryRun(
    ['discovery quality fixture'],
    [makeDecisionInput({
      companyId,
      ticker: 'QUAL',
      growthScore: 88,
      healthScore: 72,
      coverageScore: 95,
      marketCap: 1_000_000_000,
      sector: 'Technology',
      industry: 'Software',
    })],
    new Date('2026-08-01T08:00:00.000Z'),
    'rklb_daily',
    run.id,
  );
  return run.id;
}

describe('Discovery Quality Audit V1 read model', () => {
  it('joins collection provenance to stored classification and immutable decision scores', async () => {
    await qualityFixture();
    const audit = await getDiscoveryQualityAudit(new Date('2026-08-16T12:00:00Z'));
    expect(audit.overview).toMatchObject({
      totalItems: 2,
      distinctSymbols: 2,
      collectionRuns: 1,
      knownSectorItems: 1,
      knownMarketCapItems: 1,
      knownExchangeItems: 1,
      knownCountryItems: 0,
    });
    expect(audit.distributions.find((entry) => entry.key === 'country')?.available).toBe(false);
    expect(audit.scores.find((entry) => entry.key === 'growth')).toMatchObject({
      availableCount: 1,
      missingCount: 1,
      above80Count: 1,
    });
    expect(audit.distributions.find((entry) => entry.key === 'market_cap')?.buckets)
      .toContainEqual({ bucket: 'small', count: 1, percentage: 50 });
  });

  it('does not mutate collection, company, price, decision, or score tables', async () => {
    await qualityFixture();
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM collection_run_items) AS items,
         (SELECT count(*)::int FROM companies) AS companies,
         (SELECT count(*)::int FROM price_snapshots) AS prices,
         (SELECT count(*)::int FROM discovery_decisions) AS decisions,
         (SELECT count(*)::int FROM company_score_snapshots) AS scores`,
    );
    await getDiscoveryQualityAudit();
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
