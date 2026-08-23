import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { failCollectionRun, startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDataQualitySnapshot } from '../../src/lib/data-quality-snapshots';
import { recordDiscoveryRun, type DiscoveryDecisionInput } from '../../src/lib/discovery-validation';
import { buildCandidateResearchSummary, getTodayBrief } from '../../src/lib/today-brief';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { insertPriceSnapshot } from '../fixtures/price';
import { publicTables, resetDb } from '../setup/reset';

const TODAY = new Date('2026-08-16T10:00:00.000Z');
const RUN_AT = new Date('2026-08-16T08:00:00.000Z');

beforeEach(resetDb);

async function createCanonicalFixture(options: {
  ticker?: string;
  runAt?: Date;
  lookupBucket?: 'growth' | 'recall' | 'insider';
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
    growthRank: options.lookupBucket === 'recall' || options.lookupBucket === 'insider' ? null : 1,
    recallRank: options.lookupBucket === 'recall' ? 1 : null,
    insiderRank: options.lookupBucket === 'insider' ? 1 : null,
    companyId,
  });
  await succeedCollectionRun(collection.id, {
    captureDate: runAt.toISOString().slice(0, 10),
    scanned: 200,
    candidates: 1,
    flagged: 0,
    liveDataSaved: true,
    marketDataLookup: {
      growth: options.lookupBucket === 'recall' || options.lookupBucket === 'insider' ? 0 : 1,
      recall: options.lookupBucket === 'recall' ? 1 : 0,
      insider: options.lookupBucket === 'insider' ? 1 : 0,
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

  it('A2 loeb latest canonical run\'i ja included decision\'i ning annab puhtale briefile READY', async () => {
    const fixture = await createCanonicalFixture();
    const brief = await getTodayBrief(TODAY);

    expect(brief.hasTodayCanonicalRun).toBe(true);
    expect(brief.status).toBe('ready');
    expect(brief.latestCanonicalRun).toMatchObject({
      id: fixture.runId,
      decisionDate: '2026-08-16',
      evaluatedCount: 1,
      includedCount: 1,
      inputChangedAfterCanonicalSnapshot: null,
    });
    expect(brief.topCandidates).toEqual([
      expect.objectContaining({
        ticker: 'BRIEF', companyName: 'BRIEF Research Inc.', rank: 1,
        sourcePathLabel: 'Growth screen',
        researchSummary: expect.objectContaining({ priority: 'promising' }),
      }),
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
    expect(brief.status).toBe('ready');
  });

  it('A4 toob collection provenance bucketi candidate reale', async () => {
    await createCanonicalFixture({ lookupBucket: 'recall' });
    const brief = await getTodayBrief(TODAY);

    expect(brief.topCandidates[0]).toMatchObject({ ticker: 'BRIEF', lookupBucket: 'recall' });
    expect(brief.watchItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'recall_candidate', ticker: 'BRIEF' }),
    ]));
    expect(brief.status).toBe('attention');
  });

  it('A4b kuvab insider source pathi ja lookup meetrika eraldi', async () => {
    await createCanonicalFixture({ lookupBucket: 'insider' });
    const brief = await getTodayBrief(TODAY);

    expect(brief.topCandidates[0]).toMatchObject({
      ticker: 'BRIEF', lookupBucket: 'insider', sourcePathLabel: 'Notable insider purchase',
    });
    expect(brief.latestCollectionRun?.metrics).toMatchObject({
      marketDataGrowth: 0, marketDataRecall: 0, marketDataInsider: 1, marketDataTotal: 1,
    });
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
    expect(brief.status).toBe('attention');
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
      decisions([[sharedId, 'SHARED'], [newId, 'NEW']]),
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
    expect(brief.changes.repeated).toEqual([
      expect.objectContaining({
        ticker: 'SHARED', previousRank: 2, currentRank: 1, rankChange: 1,
        changedFields: [{ field: 'rank', label: 'Rank', previousValue: '#2', currentValue: '#1' }],
      }),
    ]);
    expect(brief.topCandidates.find((candidate) => candidate.ticker === 'SHARED')?.inlineChanges)
      .toEqual([{ field: 'rank', label: 'Rank', previousValue: '#2', currentValue: '#1' }]);
  });

  it('A8 annab latest collection failure korral ERROR staatuse', async () => {
    await createCanonicalFixture();
    const failed = await startCollectionRun('today-failure-test');
    await failCollectionRun(failed.id, new Error('fixture failure'));

    const brief = await getTodayBrief(TODAY);
    expect(brief.status).toBe('error');
    expect(brief.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'latest_collection_failed' }),
    ]));
  });

  it('A9 ehitab tugevale kandidaadile puhta promising research summary', async () => {
    await createCanonicalFixture({ ticker: 'ELF' });
    const candidate = (await getTodayBrief(TODAY)).topCandidates[0];

    expect(candidate.researchSummary).toMatchObject({ priority: 'promising' });
    expect(candidate.researchSummary.headline).toMatch(/Rank #1.*Growth 80.*Coverage 90/i);
    expect(candidate.researchSummary.riskBullets).toEqual([]);
  });

  it('A10 liigutab negative FCF ja dilution warningud riskBullets alla', async () => {
    await createCanonicalFixture({ ticker: 'RISK' });
    const stored = (await getTodayBrief(TODAY)).topCandidates[0];
    const { researchSummary: _ignored, ...candidate } = stored;
    const summary = buildCandidateResearchSummary({
      ...candidate,
      warnings: [
        { code: 'negative_fcf', label: 'Negative FCF' },
        { code: 'dilution_warning', label: 'Dilution warning' },
      ],
    });

    expect(summary.priority).toBe('review_first');
    expect(summary.riskBullets).toEqual(['Negative FCF', 'Dilution warning']);
  });

  it('A11 unknown provenance jääb subtle traceability note\'iks, mitte high-priority warninguks', async () => {
    await createCanonicalFixture({ ticker: 'TRACE' });
    const stored = (await getTodayBrief(TODAY)).topCandidates[0];
    const { researchSummary: _ignored, ...candidate } = stored;
    const summary = buildCandidateResearchSummary({
      ...candidate,
      lookupBucket: 'unknown',
      sourcePathLabel: 'Stored research universe',
      provenanceKnown: false,
      warnings: [],
    });

    expect(summary.priority).toBe('promising');
    expect(summary.riskBullets.join(' ')).not.toMatch(/provenance/i);
  });

  it('A12 seob salvestatud price history kandidaadi konteksti ja märgib run-up riski', async () => {
    const fixture = await createCanonicalFixture({ ticker: 'RUNUP' });
    await insertPriceSnapshot(fixture.companyId, 60, '2026-02-17T08:00:00.000Z');
    await insertPriceSnapshot(fixture.companyId, 70, '2026-05-18T08:00:00.000Z');
    await insertPriceSnapshot(fixture.companyId, 80, '2026-07-17T08:00:00.000Z');

    const brief = await getTodayBrief(TODAY);
    const candidate = brief.topCandidates[0];

    expect(candidate.priceContext).toMatchObject({
      oneMonthReturnPercent: 25,
      threeMonthReturnPercent: 42.86,
      sixMonthReturnPercent: 66.67,
      historyStatus: 'partial',
      recentRunUp: true,
    });
    expect(candidate.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'recent_run_up' }),
    ]));
    expect(brief.watchItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'recent_run_up', ticker: 'RUNUP' }),
    ]));
    expect(brief.status).toBe('attention');
  });

  it('A13 ehitab scenario valuationi ainult decision-time score snapshoti fact-viitest', async () => {
    const companyId = await insertCompany('VALUE', { name: 'Value Context Inc.' });
    const factResult = await pool.query(
      `INSERT INTO financial_facts
         (company_id, metric, value, unit, period_start, period_end, period_kind,
          fiscal_year, fiscal_period, form_type, filed_at, accession_number,
          taxonomy, tag, is_derived, source_url, fact_key, created_at, updated_at)
       VALUES ($1, 'net_income', 40000000, 'USD', '2025-01-01', '2025-12-31', 'annual',
               2025, 'FY', '10-K', '2026-02-15', 'value-annual',
               'us-gaap', 'NetIncomeLoss', false, 'https://www.sec.gov/value',
               'today-value-annual', '2026-02-15', '2026-02-15')
       RETURNING id`,
      [companyId],
    );
    const factId = Number(factResult.rows[0].id);
    const snapshotResult = await pool.query(
      `INSERT INTO company_score_snapshots
         (company_id, scoring_version, input_hash, growth_score, health_score,
          coverage_score, payload, calculated_at)
       VALUES ($1, 'scores-v1', 'today-value-input', 80, 70, 90, $2::jsonb, '2026-08-16T07:00:00Z')
       RETURNING id`,
      [companyId, JSON.stringify({
        scores: {},
        sources: [{
          metric: 'net_income', latestFactId: factId, latestPeriodEnd: '2025-12-31',
          latestValue: 40_000_000, previousFactId: null, previousPeriodEnd: null, previousValue: null,
        }],
      })],
    );
    await recordDiscoveryRun(
      ['scenario valuation fixture'],
      [makeDecisionInput({
        companyId,
        ticker: 'VALUE',
        decisionPrice: 100,
        marketCap: 1_000_000_000,
        scoreSnapshotId: Number(snapshotResult.rows[0].id),
        sector: 'Technology',
      })],
      RUN_AT,
      'rklb_daily',
    );

    const beforeLaterFact = await getTodayBrief(TODAY);
    expect(beforeLaterFact.topCandidates[0].scenarioValuation).toMatchObject({
      status: 'available',
      anchorKind: 'pe',
      scenarios: [
        { case: 'bear', impliedPrice: 64 },
        { case: 'base', impliedPrice: 100 },
        { case: 'bull', impliedPrice: 144 },
      ],
    });

    await pool.query(
      `INSERT INTO financial_facts
         (company_id, metric, value, unit, period_start, period_end, period_kind,
          fiscal_year, fiscal_period, form_type, filed_at, accession_number,
          taxonomy, tag, is_derived, source_url, fact_key)
       VALUES ($1, 'net_income', 400000000, 'USD', '2026-01-01', '2026-12-31', 'annual',
               2026, 'FY', '10-K', '2027-02-15', 'value-later',
               'us-gaap', 'NetIncomeLoss', false, 'https://www.sec.gov/value-later',
               'today-value-later')`,
      [companyId],
    );
    const afterLaterFact = await getTodayBrief(TODAY);
    expect(afterLaterFact.topCandidates[0].scenarioValuation.scenarios)
      .toEqual(beforeLaterFact.topCandidates[0].scenarioValuation.scenarios);
  });

  it('A14 seob iga adjacent rank pairi päris RKLB comparatori esimese erineva väljaga', async () => {
    const firstId = await insertCompany('FIRST', { name: 'First Research Inc.' });
    const secondId = await insertCompany('SECOND', { name: 'Second Research Inc.' });
    await recordDiscoveryRun(
      ['rank explanation fixture'],
      [
        makeDecisionInput({
          companyId: firstId,
          ticker: 'FIRST',
          candidateRank: 1,
          catalystEvidenceTier: 2,
          criteria: [{ id: 'growth', label: 'Growth', status: 'supported', detail: 'stored fixture' }],
        }),
        makeDecisionInput({
          companyId: secondId,
          ticker: 'SECOND',
          candidateRank: 2,
          catalystEvidenceTier: 4,
          growthScore: 100,
          coverageScore: 100,
          healthScore: 100,
          criteria: [],
        }),
      ],
      RUN_AT,
      'rklb_daily',
    );

    const brief = await getTodayBrief(TODAY);

    expect(brief.topCandidates).toHaveLength(2);
    expect(brief.topCandidates[0].rankComparisonToNext).toMatchObject({
      higherTicker: 'FIRST',
      lowerTicker: 'SECOND',
      decisiveFactor: 'supported_criteria',
      consistentWithComparator: true,
    });
    expect(brief.topCandidates[0].rankComparisonToNext?.summary).toMatch(/supported criteria \(1 vs 0\)/i);
    expect(brief.topCandidates[1].rankComparisonToNext).toBeNull();
  });

  it('A15 kuvab ownership badge ainult päris watchlist/portfolio/thesis kirje korral', async () => {
    const watchId = await insertCompany('OWNWATCH');
    const portfolioId = await insertCompany('OWNPORT');
    const emptyId = await insertCompany('OWNEMPTY');
    await recordDiscoveryRun(
      ['ownership fixture'],
      [
        makeDecisionInput({ companyId: watchId, ticker: 'OWNWATCH', candidateRank: 1 }),
        makeDecisionInput({ companyId: portfolioId, ticker: 'OWNPORT', candidateRank: 2 }),
        makeDecisionInput({ companyId: emptyId, ticker: 'OWNEMPTY', candidateRank: 3 }),
      ],
      RUN_AT,
      'rklb_daily',
    );
    const watchPosition = await pool.query(
      `INSERT INTO portfolio_positions
         (company_id, ticker, quantity, average_buy_price, status)
       VALUES ($1, 'OWNWATCH', 0, 0, 'watch') RETURNING id`,
      [watchId],
    );
    await pool.query(
      `INSERT INTO investment_theses (position_id, thesis, status, is_current)
       VALUES ($1, 'Stored thesis', 'researching', true)`,
      [watchPosition.rows[0].id],
    );
    await pool.query(
      `INSERT INTO portfolio_positions
         (company_id, ticker, quantity, average_buy_price, status)
       VALUES ($1, 'OWNPORT', 2, 40, 'active')`,
      [portfolioId],
    );

    const brief = await getTodayBrief(TODAY);
    const byTicker = new Map(brief.topCandidates.map((candidate) => [candidate.ticker, candidate]));

    expect(byTicker.get('OWNWATCH')?.ownershipBadges).toEqual([
      { kind: 'watchlist', label: 'Watchlist', href: '/watchlist' },
      { kind: 'thesis', label: 'Thesis · researching', href: `/thesis/${Number(watchPosition.rows[0].id)}` },
    ]);
    expect(byTicker.get('OWNPORT')?.ownershipBadges).toEqual([
      { kind: 'portfolio', label: 'Portfolio', href: '/portfolio' },
    ]);
    expect(byTicker.get('OWNEMPTY')?.ownershipBadges).toEqual([]);
  });

  it('A16 võrdleb inline muutusi ainult eelmise sama model_version canonical runiga', async () => {
    const sharedId = await insertCompany('MODELPAIR');
    const oldRun = await recordDiscoveryRun(
      ['old same-model fixture'],
      [makeDecisionInput({ companyId: sharedId, ticker: 'MODELPAIR', growthScore: 80 })],
      new Date('2026-08-14T08:00:00.000Z'),
      'rklb_daily',
    );
    const interveningRun = await recordDiscoveryRun(
      ['intervening other-model fixture'],
      [makeDecisionInput({ companyId: sharedId, ticker: 'MODELPAIR', growthScore: 10 })],
      new Date('2026-08-15T08:00:00.000Z'),
      'rklb_daily',
    );
    await pool.query(
      `UPDATE discovery_runs SET model_version = 'rklb-discovery-other-test' WHERE id = $1`,
      [interveningRun.runId],
    );
    const latestRun = await recordDiscoveryRun(
      ['latest same-model fixture'],
      [makeDecisionInput({ companyId: sharedId, ticker: 'MODELPAIR', growthScore: 85 })],
      RUN_AT,
      'rklb_daily',
    );

    const brief = await getTodayBrief(TODAY);

    expect(brief.latestCanonicalRun?.id).toBe(latestRun.runId);
    expect(brief.changes).toMatchObject({
      available: true,
      previousRunId: oldRun.runId,
      previousDecisionDate: '2026-08-14',
      modelVersionChanged: false,
    });
    expect(brief.topCandidates[0].inlineChanges).toEqual([
      { field: 'growth', label: 'Fundamental Growth', previousValue: '80', currentValue: '85' },
    ]);
  });

  it('A17 loeb catalyst human summary jaoks ainult salvestatud decision väljad', async () => {
    const companyId = await insertCompany('CATWORD');
    await recordDiscoveryRun(
      ['catalyst wording fixture'],
      [makeDecisionInput({
        companyId,
        ticker: 'CATWORD',
        catalystStatus: 'supported',
        catalystEvidenceStatus: 'material_new_evidence',
        catalystEvidenceTier: 3,
        catalystEventKind: 'sec_filing',
        catalystSourceKind: 'primary_sec',
        catalystMateriality: 'quantified_major',
        catalystDirection: 'improving',
        catalystNovelty: 'new_information',
        catalystThesisRelevance: 'decisive',
        catalystEvidenceFreshness: 'fresh',
        catalystLinkedPeriodEnd: '2026-06-30',
        catalystAt: '2026-08-10T12:00:00.000Z',
        catalystUrl: 'https://www.sec.gov/Archives/catword',
      })],
      RUN_AT,
      'rklb_daily',
    );

    const candidate = (await getTodayBrief(TODAY)).topCandidates[0];

    expect(candidate.catalystSummary).toMatchObject({
      headline: 'The SEC filing from the SEC primary source added new information.',
      sourceLabel: 'SEC primary source',
      eventLabel: 'SEC filing',
    });
    expect(candidate.catalystSummary.assessment).toMatch(/major quantified signal.*improving business evidence.*directly relevant/i);
    expect(candidate).toMatchObject({
      catalystDirection: 'improving',
      catalystNovelty: 'new_information',
      catalystThesisRelevance: 'decisive',
      catalystEvidenceFreshness: 'fresh',
      catalystLinkedPeriodEnd: '2026-06-30',
      catalystUrl: 'https://www.sec.gov/Archives/catword',
    });
  });

});
