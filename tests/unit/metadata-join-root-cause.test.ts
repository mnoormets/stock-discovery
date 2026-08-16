import { describe, expect, it } from 'vitest';
import {
  buildMetadataJoinRootCauseAudit,
  classifyMetadataJoinItem,
  type MetadataJoinSourceItem,
} from '../../src/lib/metadata-join-root-cause';

const NOW = new Date('2026-08-17T08:00:00.000Z');

function source(overrides: Partial<MetadataJoinSourceItem> = {}): MetadataJoinSourceItem {
  return {
    itemId: 1,
    runId: 1,
    ticker: 'AAA',
    observedAt: '2026-08-17T07:00:00.000Z',
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    skipReason: null,
    itemCompanyId: 10,
    linkedCompanyId: 10,
    linkedCompanyTicker: 'AAA',
    tickerCompanyId: 10,
    marketDataFound: true,
    companyMetadataExists: true,
    sectorExists: true,
    marketCapExists: true,
    exchangeExists: true,
    decisionExists: true,
    companyScoreSnapshotExists: true,
    growthScoreExists: true,
    healthScoreExists: true,
    coverageScoreExists: true,
    ...overrides,
  };
}

describe('Metadata Join Root Cause Audit V1 calculations', () => {
  it('separates selection, lookup attempt, and lookup result before join failures', () => {
    const noIdentity = { itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: null };
    expect(classifyMetadataJoinItem(source({ ...noIdentity, selectedForMarketData: false })).firstFailure)
      .toBe('NOT_SELECTED_FOR_MARKET_DATA');
    expect(classifyMetadataJoinItem(source({ ...noIdentity, marketDataAttempted: false })).firstFailure)
      .toBe('MATCH_NOT_ATTEMPTED');
    expect(classifyMetadataJoinItem(source({ ...noIdentity, marketDataFound: false })).firstFailure)
      .toBe('MARKET_DATA_NOT_FOUND');
    expect(classifyMetadataJoinItem(source({ selectedForMarketData: false })).firstFailure).toBe('COMPLETE');
  });

  it('distinguishes no company identity from an existing but unlinked company', () => {
    expect(classifyMetadataJoinItem(source({
      itemCompanyId: null,
      linkedCompanyId: null,
      linkedCompanyTicker: null,
      tickerCompanyId: null,
    })).firstFailure).toBe('NO_COMPANY_MATCH');
    const unlinked = classifyMetadataJoinItem(source({
      itemCompanyId: null,
      linkedCompanyId: null,
      linkedCompanyTicker: null,
      tickerCompanyId: 10,
    }));
    expect(unlinked).toMatchObject({
      companyIdentityExists: true,
      companyMatched: false,
      firstFailure: 'COMPANY_MATCH_NOT_LINKED',
    });
  });

  it('detects an invalid company link before later metadata stages', () => {
    const item = classifyMetadataJoinItem(source({
      linkedCompanyTicker: 'OTHER',
      tickerCompanyId: null,
    }));
    expect(item.firstFailure).toBe('COMPANY_LINK_MISMATCH');
    expect(item.finalResearchReady).toBe(false);
  });

  it('applies the deterministic first-failure order through metadata and scoring', () => {
    expect(classifyMetadataJoinItem(source({ companyMetadataExists: false })).firstFailure)
      .toBe('COMPANY_FOUND_METADATA_MISSING');
    expect(classifyMetadataJoinItem(source({ sectorExists: false })).firstFailure).toBe('SECTOR_MISSING');
    expect(classifyMetadataJoinItem(source({ marketCapExists: false })).firstFailure).toBe('MARKET_CAP_MISSING');
    expect(classifyMetadataJoinItem(source({ exchangeExists: false })).firstFailure).toBe('EXCHANGE_MISSING');
    expect(classifyMetadataJoinItem(source({
      decisionExists: false,
      growthScoreExists: false,
      healthScoreExists: false,
      coverageScoreExists: false,
    })).firstFailure).toBe('SCORES_MISSING');
    expect(classifyMetadataJoinItem(source()).firstFailure).toBe('COMPLETE');
  });

  it('keeps exact decision scoring separate from score completeness', () => {
    const partial = classifyMetadataJoinItem(source({
      growthScoreExists: false,
      healthScoreExists: true,
      coverageScoreExists: true,
    }));
    expect(partial).toMatchObject({
      scoringDataExists: true,
      scoresComplete: false,
      firstFailure: 'COMPLETE',
    });
  });

  it('builds a cumulative funnel and mutually exclusive failure percentages', () => {
    const report = buildMetadataJoinRootCauseAudit([
      source({ itemId: 1, ticker: 'NONE', itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: null }),
      source({ itemId: 2, ticker: 'UNLINKED', itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: 20 }),
      source({ itemId: 3, ticker: 'NOSECTOR', itemCompanyId: 30, linkedCompanyId: 30, linkedCompanyTicker: 'NOSECTOR', tickerCompanyId: 30, sectorExists: false }),
      source({ itemId: 4, ticker: 'DONE', itemCompanyId: 40, linkedCompanyId: 40, linkedCompanyTicker: 'DONE', tickerCompanyId: 40 }),
    ], NOW);
    expect(report.funnel.map((stage) => [stage.key, stage.count, stage.droppedFromPrevious])).toEqual([
      ['collection_items', 4, 0],
      ['company_identity', 3, 1],
      ['company_match', 2, 1],
      ['company_metadata', 2, 0],
      ['sector', 1, 1],
      ['market_cap', 1, 0],
      ['exchange', 1, 0],
      ['scoring', 1, 0],
      ['final_research', 1, 0],
    ]);
    expect(report.failures.reduce((sum, failure) => sum + failure.count, 0)).toBe(4);
    expect(report.failures.reduce((sum, failure) => sum + failure.percentage, 0)).toBe(100);
  });

  it('generates data-supported highlights and a safe empty state', () => {
    const report = buildMetadataJoinRootCauseAudit([
      source({ itemId: 1, ticker: 'NONE1', itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: null, decisionExists: false, growthScoreExists: false, healthScoreExists: false, coverageScoreExists: false }),
      source({ itemId: 2, ticker: 'NONE2', itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: null, decisionExists: false, growthScoreExists: false, healthScoreExists: false, coverageScoreExists: false }),
      source({ itemId: 3, ticker: 'SCORED', itemCompanyId: null, linkedCompanyId: null, linkedCompanyTicker: null, tickerCompanyId: 30 }),
    ], NOW);
    expect(report.highlights).toContain('The largest first failure is no company identity: 2 items (66.7%).');
    expect(report.highlights).toContain('1 items have exact decision scoring data despite a missing or invalid collection-item company link.');
    const empty = buildMetadataJoinRootCauseAudit([], NOW);
    expect(empty.summary.totalItems).toBe(0);
    expect(empty.highlights).toEqual([]);
    expect(empty.failures).toEqual([]);
  });
});
