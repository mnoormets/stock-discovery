import { beforeEach, describe, expect, inject, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun, refreshCandidateOutcomes } from '../../src/lib/discovery-validation';
import {
  OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
  buildOutcomeAnalysisSnapshot,
  getOutcomeAnalysisSnapshotForOutcome,
  getOutcomeAnalysisSummary,
  recordMissingOutcomeAnalysisSnapshots,
  recordOutcomeAnalysisSnapshot,
} from '../../src/lib/outcome-analysis-snapshots';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

const RUN_AT = new Date('2026-08-01T08:00:00.000Z');

beforeEach(resetDb);

async function insertQuality(runId: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO data_quality_snapshots (
       run_id, snapshot_version, evaluated_count, included_count, companies_total,
       companies_with_sec_facts, companies_with_scores, companies_with_sector,
       companies_with_recent_price, stale_financials_count, missing_financials_count,
       missing_price_count, missing_sector_count, low_coverage_count,
       partial_mandate_count, not_relevant_mandate_count, negative_fcf_count,
       dilution_warning_count, metrics, warnings
     ) VALUES ($1,'data-quality-snapshot-v1',4,1,4,3,4,2,3,1,1,1,2,1,0,0,0,0,
               '{"fixture":true}'::jsonb,'["quality-warning"]'::jsonb)
     RETURNING id`,
    [runId],
  );
  return Number(rows[0].id);
}

async function fixture(options: {
  ticker?: string;
  bucket?: 'growth' | 'recall' | 'insider';
  withCollection?: boolean;
  withQuality?: boolean;
  growthScore?: number | null;
  coverageScore?: number;
  catalystTier?: number | null;
  mandate?: string | null;
} = {}) {
  const ticker = options.ticker || 'OAAS';
  const companyId = await insertCompany(ticker);
  let collectionRunId: number | null = null;
  let collectionItemId: number | null = null;
  if (options.withCollection !== false) {
    collectionRunId = (await startCollectionRun('outcome-analysis-test')).id;
    const bucket = options.bucket || 'growth';
    const item = await recordCollectionRunItem({
      collectionRunId,
      ticker,
      lookupBucket: bucket,
      selectedForMarketData: true,
      marketDataAttempted: true,
      marketDataFound: true,
      marketDataSource: 'yahoo',
      companyId,
      growthRank: bucket === 'growth' ? 1 : null,
      recallRank: bucket === 'recall' ? 1 : null,
      insiderRank: bucket === 'insider' ? 1 : null,
      rawSignal: { source: 'apewisdom' },
    });
    collectionItemId = item.id;
    await succeedCollectionRun(collectionRunId);
  }
  const discovery = await recordDiscoveryRun(
    ['outcome analysis fixture'],
    [makeDecisionInput({
      companyId,
      ticker,
      growthScore: options.growthScore === undefined ? 88 : options.growthScore,
      coverageScore: options.coverageScore ?? 92,
      catalystEvidenceTier: options.catalystTier === undefined ? 2 : options.catalystTier,
      catalystMandateRelevance: options.mandate === undefined ? 'fits' : options.mandate,
    })],
    RUN_AT,
    'rklb_daily',
    collectionRunId,
  );
  const decision = await pool.query(
    'SELECT id, collection_run_item_id FROM discovery_decisions WHERE run_id = $1',
    [discovery.runId],
  );
  const outcome = await pool.query(
    `SELECT id FROM candidate_outcomes WHERE decision_id = $1 AND horizon = '1w'`,
    [decision.rows[0].id],
  );
  const qualityId = options.withQuality === false ? null : await insertQuality(discovery.runId);
  return {
    companyId,
    discoveryRunId: discovery.runId,
    decisionId: Number(decision.rows[0].id),
    linkedCollectionItemId: decision.rows[0].collection_run_item_id == null
      ? null : Number(decision.rows[0].collection_run_item_id),
    collectionItemId,
    outcomeId: Number(outcome.rows[0].id),
    qualityId,
  };
}

async function measure(
  outcomeId: number,
  candidateReturn: number,
  benchmarkReturn: number | null,
  excessReturn: number | null,
) {
  await pool.query(
    `UPDATE candidate_outcomes
     SET status = 'measured', return_percent = $2, measured_at = '2026-08-09T08:00:00Z',
         benchmark_status = $3,
         benchmark_return_percent = $4, excess_return_percent = $5
     WHERE id = $1`,
    [outcomeId, candidateReturn, benchmarkReturn == null ? 'missing' : 'measured', benchmarkReturn, excessReturn],
  );
}

describe('Outcome Analysis Snapshot V1', () => {
  it('A1 külmutab winneri recall-provenance, skoorid, kvaliteedi, catalysti ja mandaadi', async () => {
    const f = await fixture({ bucket: 'recall' });
    await measure(f.outcomeId, 10, 4, 6);
    const saved = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    expect(saved).toMatchObject({
      snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
      outcomeId: f.outcomeId,
      decisionId: f.decisionId,
      collectionRunItemId: f.collectionItemId,
      dataQualitySnapshotId: f.qualityId,
      ticker: 'OAAS',
      lookupBucket: 'recall',
      winnerStatus: 'winner',
      benchmarkBeatStatus: 'beat',
      growthScore: 88,
      coverageScore: 92,
      catalystEvidenceTier: 2,
      catalystMandateRelevance: 'fits',
      dataQualityStatus: 'available',
      secFactsCoveragePercent: 75,
      scoreCoveragePercent: 100,
      recentPriceCoveragePercent: 75,
    });
  });

  it('A2 eristab winneri benchmark beatist', async () => {
    const f = await fixture();
    await measure(f.outcomeId, -1, -5, 4);
    const saved = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    expect(saved.winnerStatus).toBe('not_winner');
    expect(saved.benchmarkBeatStatus).toBe('beat');
  });

  it('A2b säilitab insider bucketi outcome snapshotis', async () => {
    const f = await fixture({ bucket: 'insider' });
    await measure(f.outcomeId, 3, 1, 2);
    const saved = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    expect(saved.lookupBucket).toBe('insider');
  });

  it('A3 kasutab puuduvate otsusehetke sisendite puhul unknown väärtusi', async () => {
    const f = await fixture({
      withCollection: false,
      withQuality: false,
      catalystTier: null,
      mandate: null,
      growthScore: null,
    });
    await pool.query("UPDATE discovery_decisions SET analysis_scope = 'unknown' WHERE id = $1", [f.decisionId]);
    await measure(f.outcomeId, 2, null, null);
    const saved = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    expect(saved).toMatchObject({
      winnerStatus: 'winner',
      benchmarkBeatStatus: 'unknown',
      lookupBucket: 'unknown',
      dataQualityStatus: 'unknown',
      growthScore: null,
      catalystEvidenceTier: null,
      catalystMandateRelevance: 'unknown',
      decisionScope: 'unknown',
    });
    expect(saved.warnings).toEqual(expect.arrayContaining([
      'collection_provenance_unknown', 'data_quality_unknown',
      'catalyst_tier_unknown', 'mandate_relevance_unknown', 'benchmark_beat_unknown',
    ]));
    const summary = await getOutcomeAnalysisSummary();
    expect(summary).toMatchObject({ snapshotCount: 0, excludedNonCanonicalCount: 1 });
  });

  it('A4 keeldub snapshotist enne outcome measured olekut', async () => {
    const f = await fixture();
    await expect(buildOutcomeAnalysisSnapshot(f.outcomeId)).rejects.toThrow('ei ole measured');
  });

  it('A5 identne kordus tagastab sama rea ega loe hilisemaid source-muudatusi', async () => {
    const f = await fixture();
    await measure(f.outcomeId, 10, 4, 6);
    const first = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    await pool.query('UPDATE candidate_outcomes SET return_percent = 999, excess_return_percent = 998 WHERE id = $1', [f.outcomeId]);
    await pool.query('UPDATE discovery_decisions SET growth_score = 1, coverage_score = 2 WHERE id = $1', [f.decisionId]);
    const second = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    expect(second).toEqual(first);
    expect(second.candidateReturnPercent).toBe(10);
    expect(second.growthScore).toBe(88);
    expect(await getOutcomeAnalysisSnapshotForOutcome(f.outcomeId)).toEqual(first);
  });

  it('A6 DB keelab snapshoti UPDATE ja DELETE operatsioonid', async () => {
    const f = await fixture();
    await measure(f.outcomeId, 5, 2, 3);
    const saved = await recordOutcomeAnalysisSnapshot(f.outcomeId);
    await expect(pool.query(
      'UPDATE outcome_analysis_snapshots SET growth_score = 0 WHERE id = $1', [saved.id],
    )).rejects.toThrow('immutable');
    await expect(pool.query(
      'DELETE FROM outcome_analysis_snapshots WHERE id = $1', [saved.id],
    )).rejects.toThrow('immutable');
  });

  it('A7 summary vastab bucket-, score-, quality-, tier- ja mandate gruppidega', async () => {
    const recall = await fixture({ ticker: 'RECA', bucket: 'recall', growthScore: 95, coverageScore: 98, catalystTier: 1, mandate: 'fits' });
    await measure(recall.outcomeId, 12, 4, 8);
    await recordOutcomeAnalysisSnapshot(recall.outcomeId);

    // Teine canonical päev, et canonical run-key ei taaskasutaks esimest run'i.
    const companyId = await insertCompany('GROW');
    const collectionRunId = (await startCollectionRun('outcome-analysis-test')).id;
    await recordCollectionRunItem({
      collectionRunId, ticker: 'GROW', lookupBucket: 'growth',
      selectedForMarketData: true, marketDataAttempted: true, marketDataFound: true,
      marketDataSource: 'yahoo', companyId, growthRank: 1,
    });
    await succeedCollectionRun(collectionRunId);
    const run = await recordDiscoveryRun(
      ['outcome analysis fixture'],
      [makeDecisionInput({
        companyId, ticker: 'GROW', growthScore: 60, coverageScore: 70,
        catalystEvidenceTier: 3, catalystMandateRelevance: 'partial',
      })],
      new Date('2026-08-02T08:00:00.000Z'),
      'rklb_daily',
      collectionRunId,
    );
    await insertQuality(run.runId);
    const growOutcome = await pool.query(
      `SELECT o.id FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id
       WHERE d.run_id = $1 AND o.horizon = '1w'`,
      [run.runId],
    );
    const growOutcomeId = Number(growOutcome.rows[0].id);
    await measure(growOutcomeId, -4, -2, -2);
    await recordOutcomeAnalysisSnapshot(growOutcomeId);

    const summary = await getOutcomeAnalysisSummary();
    expect(summary.snapshotCount).toBe(2);
    expect(summary.byLookupBucket.find((group) => group.value === 'recall')).toMatchObject({
      winnerCount: 1, benchmarkBeatCount: 1, averageGrowthScore: 95, averageCoverageScore: 98,
    });
    expect(summary.byLookupBucket.find((group) => group.value === 'growth')).toMatchObject({
      winnerCount: 0, benchmarkBeatCount: 0, averageGrowthScore: 60, averageCoverageScore: 70,
    });
    expect(summary.byCatalystTier.map((group) => group.value)).toEqual(['tier_1', 'tier_3']);
    expect(summary.byMandateRelevance.map((group) => group.value)).toEqual(['fits', 'partial']);
  });

  it('A8 refreshCandidateOutcomes loob esimese measured outcome snapshoti automaatselt', async () => {
    const f = await fixture({ withQuality: false });
    await insertPriceSnapshot(f.companyId, 110, '2026-08-08T08:00:00.000Z');
    await refreshCandidateOutcomes(new Date('2026-08-09T08:00:00.000Z'));
    const snapshot = await getOutcomeAnalysisSnapshotForOutcome(f.outcomeId);
    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({ winnerStatus: 'winner', benchmarkBeatStatus: 'unknown' });
  });

  it('A9 canonical decision saab tickeritaseme item-FK, manual decision jääb nullable', async () => {
    const canonical = await fixture();
    expect(canonical.linkedCollectionItemId).toBe(canonical.collectionItemId);

    const manualCompany = await insertCompany('MANL');
    const manual = await recordDiscoveryRun(
      ['manual fixture'],
      [makeDecisionInput({ companyId: manualCompany, ticker: 'MANL' })],
      RUN_AT,
      'rklb',
    );
    const { rows } = await pool.query(
      'SELECT collection_run_item_id FROM discovery_decisions WHERE run_id = $1',
      [manual.runId],
    );
    expect(rows[0].collection_run_item_id).toBeNull();
  });

  it('A10 batch recorder täidab ainult puuduva measured snapshoti', async () => {
    const f = await fixture();
    await measure(f.outcomeId, 3, 1, 2);
    expect(await recordMissingOutcomeAnalysisSnapshots()).toBe(1);
    expect(await recordMissingOutcomeAnalysisSnapshots()).toBe(0);
  });

  it('A11 test DB sisaldab 0005 migratsiooni, tabelit, link-veergu ja immutable triggerit', async () => {
    expect(inject('appliedMigrations')).toContain('0005_outcome_analysis_snapshots');
    expect(inject('migratedTables')).toContain('outcome_analysis_snapshots');
    const { rows } = await pool.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='discovery_decisions'
                  AND column_name='collection_run_item_id') AS has_link,
        EXISTS (SELECT 1 FROM pg_trigger
                WHERE tgrelid='outcome_analysis_snapshots'::regclass
                  AND tgname='outcome_analysis_snapshots_immutable' AND NOT tgisinternal) AS has_trigger`);
    expect(rows[0]).toEqual({ has_link: true, has_trigger: true });
  });
});
