import { beforeEach, describe, expect, inject, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import {
  DATA_QUALITY_SNAPSHOT_VERSION,
  buildDataQualitySnapshot,
  getDataQualitySnapshotForRun,
  recordDataQualitySnapshot,
} from '../../src/lib/data-quality-snapshots';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

const RUN_AT = new Date('2026-08-15T08:00:00.000Z');
const CREATED_AT = '2026-01-01T00:00:00.000Z';

interface QualityFixture {
  runId: number;
  companyIds: [number, number, number];
}

async function insertFact(
  companyId: number,
  metric: string,
  value: number,
  periodEnd: string,
  suffix: string,
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO financial_facts (
       company_id, metric, value, unit, period_end, period_kind, form_type,
       filed_at, accession_number, taxonomy, tag, source_url, fact_key, created_at
     ) VALUES ($1,$2,$3,'USD',$4,'annual','10-K',$4,$5,'us-gaap',$2,
               'https://www.sec.gov/test',$6,$7)
     RETURNING id`,
    [companyId, metric, value, periodEnd, `0000000000-26-${suffix}`, `${companyId}:${metric}:${suffix}`, CREATED_AT],
  );
  return Number(result.rows[0].id);
}

async function insertScoreSnapshot(
  companyId: number,
  ticker: string,
  sources: Array<{ metric: string; latestFactId: number; latestPeriodEnd: string; latestValue: number }>,
  dilutionScore = 100,
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO company_score_snapshots (
       company_id, scoring_version, input_hash, growth_score, health_score,
       coverage_score, payload, calculated_at
     ) VALUES ($1,'scores-v1',$2,80,75,90,$3::jsonb,$4)
     RETURNING id`,
    [
      companyId,
      `quality-${ticker}`,
      JSON.stringify({
        sources: sources.map((source) => ({
          ...source,
          previousFactId: null,
          previousPeriodEnd: null,
          previousValue: null,
        })),
        scores: {
          growth: { score: 80, components: [] },
          financialHealth: { score: 75, components: [{ id: 'dilution', score: dilutionScore }] },
          coverage: { score: 90, components: [] },
        },
      }),
      '2026-08-15T07:30:00.000Z',
    ],
  );
  return Number(result.rows[0].id);
}

async function createThreeCompanyRun(): Promise<QualityFixture> {
  const fullId = await insertCompany('FULL');
  const noSecId = await insertCompany('NOSEC');
  const staleId = await insertCompany('STALE');
  await pool.query(
    `UPDATE companies SET created_at = $1,
       sector = CASE ticker WHEN 'FULL' THEN 'Technology' WHEN 'NOSEC' THEN 'Industrials' ELSE NULL END
     WHERE id = ANY($2::bigint[])`,
    [CREATED_AT, [fullId, noSecId, staleId]],
  );

  const fullPriceId = await insertPriceSnapshot(fullId, 100, '2026-08-14T20:00:00.000Z');
  const noSecPriceId = await insertPriceSnapshot(noSecId, 50, '2026-08-14T20:00:00.000Z');
  const stalePriceId = await insertPriceSnapshot(staleId, 20, '2026-06-01T20:00:00.000Z');

  const fullRevenueId = await insertFact(fullId, 'revenue', 1_000, '2025-12-31', '000001');
  const fullFcfId = await insertFact(fullId, 'free_cash_flow', 100, '2025-12-31', '000002');
  const fullSharesId = await insertFact(fullId, 'shares_outstanding', 1_000_000, '2025-12-31', '000003');
  const staleFcfId = await insertFact(staleId, 'free_cash_flow', -10, '2023-01-01', '000004');
  const staleSharesId = await insertFact(staleId, 'shares_outstanding', 2_000_000, '2023-01-01', '000005');

  const fullScoreId = await insertScoreSnapshot(fullId, 'FULL', [
    { metric: 'revenue', latestFactId: fullRevenueId, latestPeriodEnd: '2025-12-31', latestValue: 1_000 },
    { metric: 'free_cash_flow', latestFactId: fullFcfId, latestPeriodEnd: '2025-12-31', latestValue: 100 },
    { metric: 'shares_outstanding', latestFactId: fullSharesId, latestPeriodEnd: '2025-12-31', latestValue: 1_000_000 },
  ]);
  const staleScoreId = await insertScoreSnapshot(staleId, 'STALE', [
    { metric: 'free_cash_flow', latestFactId: staleFcfId, latestPeriodEnd: '2023-01-01', latestValue: -10 },
    { metric: 'shares_outstanding', latestFactId: staleSharesId, latestPeriodEnd: '2023-01-01', latestValue: 2_000_000 },
  ], 0);

  const decisions = [
    makeDecisionInput({
      companyId: fullId,
      ticker: 'FULL',
      sector: 'Technology',
      priceSnapshotId: fullPriceId,
      scoreSnapshotId: fullScoreId,
      catalystMandateRelevance: 'fits',
    }),
    makeDecisionInput({
      companyId: noSecId,
      ticker: 'NOSEC',
      included: false,
      candidateRank: null,
      coverageScore: 20,
      sector: 'Industrials',
      priceSnapshotId: noSecPriceId,
      scoreSnapshotId: null,
      catalystMandateRelevance: 'partial',
    }),
    makeDecisionInput({
      companyId: staleId,
      ticker: 'STALE',
      included: false,
      candidateRank: null,
      sector: null,
      priceSnapshotId: stalePriceId,
      scoreSnapshotId: staleScoreId,
      catalystMandateRelevance: 'not_relevant',
    }),
  ];
  const run = await recordDiscoveryRun(['quality fixture'], decisions, RUN_AT, 'rklb_daily');
  return { runId: run.runId, companyIds: [fullId, noSecId, staleId] };
}

beforeEach(async () => {
  await resetDb();
});

describe('A — canonical data-quality snapshot', () => {
  it('A1 loob canonical run\'ile täpselt ühe snapshoti', async () => {
    const fixture = await createThreeCompanyRun();
    const recorded = await recordDataQualitySnapshot(fixture.runId);
    const count = await pool.query(
      'SELECT count(*)::int AS count FROM data_quality_snapshots WHERE run_id = $1',
      [fixture.runId],
    );

    expect(recorded.created).toBe(true);
    expect(recorded.snapshotVersion).toBe(DATA_QUALITY_SNAPSHOT_VERSION);
    expect(count.rows[0].count).toBe(1);
  });

  it('A2 on idempotentne ega kirjuta olemasolevat snapshoti üle', async () => {
    const fixture = await createThreeCompanyRun();
    const first = await recordDataQualitySnapshot(fixture.runId);
    const second = await recordDataQualitySnapshot(fixture.runId);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second).toMatchObject({ id: first.id, capturedAt: first.capturedAt, metrics: first.metrics });
  });

  it('A3 keelab manual rklb run\'i snapshoti', async () => {
    const companyId = await insertCompany('MANUAL');
    const run = await recordDiscoveryRun(
      ['manual fixture'],
      [makeDecisionInput({ companyId, ticker: 'MANUAL' })],
      RUN_AT,
      'rklb',
    );

    await expect(recordDataQualitySnapshot(run.runId)).rejects.toThrow(/only allowed for rklb_daily/);
    expect(await getDataQualitySnapshotForRun(run.runId)).toBeNull();
  });

  it('A4 annab kolme ettevõtte fixture\'il deterministlikud coverage-loendurid', async () => {
    const fixture = await createThreeCompanyRun();
    const snapshot = await buildDataQualitySnapshot(fixture.runId);

    expect(snapshot).toMatchObject({
      evaluatedCount: 3,
      includedCount: 1,
      companiesTotal: 3,
      companiesWithSecFacts: 2,
      companiesWithScores: 2,
      companiesWithSector: 2,
      companiesWithRecentPrice: 2,
      missingFinancialsCount: 1,
      missingPriceCount: 1,
      missingSectorCount: 1,
      staleFinancialsCount: 1,
      lowCoverageCount: 1,
      partialMandateCount: 1,
      notRelevantMandateCount: 1,
      negativeFcfCount: 1,
      dilutionWarningCount: 1,
      newestFinancialPeriodEnd: '2025-12-31',
      oldestFinancialPeriodEnd: '2023-01-01',
    });
  });

  it('A5 ei loe outcome tulemusi ega muuda juba salvestatud snapshoti', async () => {
    const fixture = await createThreeCompanyRun();
    const first = await recordDataQualitySnapshot(fixture.runId);
    await pool.query(
      `UPDATE candidate_outcomes o
       SET status = 'measured', observed_at = target_at, observed_price = 999, return_percent = 899
       FROM discovery_decisions d
       WHERE o.decision_id = d.id AND d.run_id = $1 AND o.horizon = '1w'`,
      [fixture.runId],
    );

    const rebuilt = await buildDataQualitySnapshot(fixture.runId);
    const second = await recordDataQualitySnapshot(fixture.runId);
    expect(rebuilt.metrics).toEqual(first.metrics);
    expect(second).toEqual({ ...first, created: false });
  });

  it('A6 jõustab UNIQUE(run_id) piirangu ka otse SQL-is', async () => {
    const fixture = await createThreeCompanyRun();
    await recordDataQualitySnapshot(fixture.runId);

    await expect(pool.query(
      `INSERT INTO data_quality_snapshots (
         run_id, snapshot_version, evaluated_count, included_count, companies_total,
         companies_with_sec_facts, companies_with_scores, companies_with_sector,
         companies_with_recent_price, newest_financial_period_end, oldest_financial_period_end,
         stale_financials_count, missing_financials_count, missing_price_count,
         missing_sector_count, low_coverage_count, partial_mandate_count,
         not_relevant_mandate_count, negative_fcf_count, dilution_warning_count,
         metrics, warnings
       ) SELECT run_id, snapshot_version, evaluated_count, included_count, companies_total,
                companies_with_sec_facts, companies_with_scores, companies_with_sector,
                companies_with_recent_price, newest_financial_period_end, oldest_financial_period_end,
                stale_financials_count, missing_financials_count, missing_price_count,
                missing_sector_count, low_coverage_count, partial_mandate_count,
                not_relevant_mandate_count, negative_fcf_count, dilution_warning_count,
                metrics, warnings
         FROM data_quality_snapshots WHERE run_id = $1`,
      [fixture.runId],
    )).rejects.toThrow();
  });

  it('A7 test DB sisaldab 0003 migratsiooni ja uut tabelit', async () => {
    expect(inject('appliedMigrations')).toContain('0003_data_quality_snapshots');
    const table = await pool.query("SELECT to_regclass('public.data_quality_snapshots') AS name");
    expect(table.rows[0].name).toBe('data_quality_snapshots');
  });
});

