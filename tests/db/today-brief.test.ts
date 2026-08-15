import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDataQualitySnapshot } from '../../src/lib/data-quality-snapshots';
import { recordDiscoveryRun, type DiscoveryDecisionInput } from '../../src/lib/discovery-validation';
import { getTodayBrief } from '../../src/lib/today-brief';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { publicTables, resetDb } from '../setup/reset';

const TODAY = new Date('2026-08-16T10:00:00.000Z');
const RUN_AT = new Date('2026-08-16T08:00:00.000Z');

beforeEach(resetDb);

async function createCanonicalFixture(options: {
  ticker?: string;
  runAt?: Date;
  lookupBucket?: 'growth' | 'recall';
  mandate?: string | null;
  coverage?: number;
  quality?: boolean;
} = {}) {
  const ticker = options.ticker || 'BRIEF';
  const runAt = options.runAt || RUN_AT;
  const companyId = await insertCompany(ticker, { name: `${ticker} Research Inc.` });
  await pool.query(
    `UPDATE companies SET created_at = '2026-01-01T00:00:00.000Z', sector = 'Technology'
     WHERE id = $1`,
    [companyId],
  );
  const collection = await startCollectionRun('today-test');
  await recordCollectionRunItem({
    collectionRunId: collection.id,
    ticker,
    lookupBucket: options.lookupBucket || 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    mentionCount: 20,
    previousMentionCount: 10,
    mentionGrowthPercent: 100,
    attentionRank: 2,
    growthRank: options.lookupBucket === 'recall' ? null : 1,
    recallRank: options.lookupBucket === 'recall' ? 1 : null,
    companyId,
  });
  await succeedCollectionRun(collection.id, {
    captureDate: runAt.toISOString().slice(0, 10),
    scanned: 200,
    candidates: 1,
    flagged: 0,
    liveDataSaved: true,
    marketDataLookup: {
      growth: options.lookupBucket === 'recall' ? 0 : 1,
      recall: options.lookupBucket === 'recall' ? 1 : 0,
      total: 1,
    },
  });
  const decision = makeDecisionInput({
    companyId,
    ticker,
    coverageScore: options.coverage ?? 90,
    catalystMandateRelevance: options.mandate ?? 'fits',
    sector: 'Technology',
  });
  const run = await recordDiscoveryRun(
    ['today brief fixture'],
    [decision],
    runAt,
    'rklb_daily',
    collection.id,
  );
  if (options.quality) await recordDataQualitySnapshot(run.runId);
  return { companyId, collectionRunId: collection.id, runId: run.runId };
}

async function rowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of await publicTables()) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
    counts[table] = Number(result.rows[0].count);
  }
  return counts;
}

describe('Daily Research Brief read model', () => {
  it('A1 tagastab puuduva canonical päeva korral waiting oleku ja warningu', async () => {
    const brief = await getTodayBrief(TODAY);

    expect(brief.hasTodayCanonicalRun).toBe(false);
    expect(brief.status).toBe('waiting');
    expect(brief.latestCanonicalRun).toBeNull();
    expect(brief.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'today_canonical_missing' }),
    ]));
  });

  it('A2 loeb latest canonical run\'i ja included decision\'i', async () => {
    const fixture = await createCanonicalFixture();
    const brief = await getTodayBrief(TODAY);

    expect(brief.hasTodayCanonicalRun).toBe(true);
    expect(brief.status).toBe('ok');
    expect(brief.latestCanonicalRun).toMatchObject({
      id: fixture.runId,
      decisionDate: '2026-08-16',
      evaluatedCount: 1,
      includedCount: 1,
      inputChangedAfterCanonicalSnapshot: null,
    });
    expect(brief.topCandidates).toEqual([
      expect.objectContaining({ ticker: 'BRIEF', companyName: 'BRIEF Research Inc.', rank: 1 }),
    ]);
  });

  it('A3 seob latest run\'iga selle immutable data-quality snapshot\'i', async () => {
    await createCanonicalFixture({ quality: true });
    const brief = await getTodayBrief(TODAY);

    expect(brief.dataQuality).toMatchObject({
      companiesTotal: 1,
      companiesWithSecFacts: 0,
      missingFinancialsCount: 1,
      missingSectorCount: 0,
      status: 'warning',
    });
    expect(brief.dataQuality?.warnings.join(' ')).toMatch(/no SEC financial facts/i);
  });

  it('A4 toob collection provenance bucketi candidate reale', async () => {
    await createCanonicalFixture({ lookupBucket: 'recall' });
    const brief = await getTodayBrief(TODAY);

    expect(brief.topCandidates[0]).toMatchObject({ ticker: 'BRIEF', lookupBucket: 'recall' });
    expect(brief.watchItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'recall_candidate', ticker: 'BRIEF' }),
    ]));
  });

  it('A5 märgib included not_relevant mandate kandidaadi inimese kontrolliks', async () => {
    await createCanonicalFixture({ mandate: 'not_relevant' });
    const brief = await getTodayBrief(TODAY);

    expect(brief.topCandidates[0].warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'not_relevant_mandate' }),
    ]));
    expect(brief.watchItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'not_relevant_mandate', severity: 'critical' }),
    ]));
  });

  it('A6 ei muuda brief\'i lugemisel ühegi public tabeli ridade arvu', async () => {
    await createCanonicalFixture({ quality: true });
    const before = await rowCounts();

    await getTodayBrief(TODAY);

    expect(await rowCounts()).toEqual(before);
  });

  it('A7 võrdleb viimase kahe canonical päeva new/removed/repeated tickereid', async () => {
    const oldId = await insertCompany('OLD');
    const sharedId = await insertCompany('SHARED');
    const newId = await insertCompany('NEW');
    const decisions = (items: Array<[number, string]>): DiscoveryDecisionInput[] => items.map(([companyId, ticker], index) => (
      makeDecisionInput({ companyId, ticker, candidateRank: index + 1, sector: 'Technology' })
    ));
    await recordDiscoveryRun(
      ['previous'],
      decisions([[oldId, 'OLD'], [sharedId, 'SHARED']]),
      new Date('2026-08-15T08:00:00.000Z'),
      'rklb_daily',
    );
    await recordDiscoveryRun(
      ['latest'],
      decisions([[newId, 'NEW'], [sharedId, 'SHARED']]),
      RUN_AT,
      'rklb_daily',
    );

    const brief = await getTodayBrief(TODAY);
    expect(brief.changes).toMatchObject({
      available: true,
      previousDecisionDate: '2026-08-15',
      newIncludedTickers: ['NEW'],
      removedTickers: ['OLD'],
      repeatedTickers: ['SHARED'],
    });
  });
});
