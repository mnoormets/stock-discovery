import { pool } from './db';

export type MetadataJoinFailureClass =
  | 'NOT_SELECTED_FOR_MARKET_DATA'
  | 'MATCH_NOT_ATTEMPTED'
  | 'MARKET_DATA_NOT_FOUND'
  | 'NO_COMPANY_MATCH'
  | 'COMPANY_MATCH_NOT_LINKED'
  | 'COMPANY_LINK_MISMATCH'
  | 'COMPANY_FOUND_METADATA_MISSING'
  | 'SECTOR_MISSING'
  | 'MARKET_CAP_MISSING'
  | 'EXCHANGE_MISSING'
  | 'SCORES_MISSING'
  | 'COMPLETE';

export interface MetadataJoinSourceItem {
  itemId: number;
  runId: number;
  ticker: string;
  observedAt: string;
  lookupBucket: string;
  selectedForMarketData: boolean;
  marketDataAttempted: boolean;
  skipReason: string | null;
  itemCompanyId: number | null;
  linkedCompanyId: number | null;
  linkedCompanyTicker: string | null;
  tickerCompanyId: number | null;
  marketDataFound: boolean;
  companyMetadataExists: boolean;
  sectorExists: boolean;
  marketCapExists: boolean;
  exchangeExists: boolean;
  decisionExists: boolean;
  companyScoreSnapshotExists: boolean;
  growthScoreExists: boolean;
  healthScoreExists: boolean;
  coverageScoreExists: boolean;
}

export interface MetadataJoinDiagnosticItem extends MetadataJoinSourceItem {
  companyIdentityExists: boolean;
  companyMatched: boolean;
  scoringDataExists: boolean;
  scoresComplete: boolean;
  finalResearchReady: boolean;
  firstFailure: MetadataJoinFailureClass;
  explanation: string;
}

export interface MetadataJoinFunnelStage {
  key: string;
  label: string;
  count: number;
  percentageOfItems: number;
  droppedFromPrevious: number;
}

export interface MetadataJoinFailureSummary {
  failureClass: MetadataJoinFailureClass;
  label: string;
  count: number;
  percentage: number;
}

export interface MetadataJoinSummary {
  totalItems: number;
  selectedCount: number;
  matchAttemptedCount: number;
  marketDataFoundCount: number;
  companyIdentityCount: number;
  companyMatchedCount: number;
  exactDecisionCount: number;
  companyScoreSnapshotCount: number;
  scoringDataCount: number;
  completeCount: number;
  decisionScoresWithoutCompanyLinkCount: number;
  unselectedIdentityCount: number;
  marketDataFoundWithoutIdentityCount: number;
}

export interface MetadataJoinRootCauseAudit {
  generatedAt: string;
  sampleUnit: string;
  summary: MetadataJoinSummary;
  funnel: MetadataJoinFunnelStage[];
  failures: MetadataJoinFailureSummary[];
  items: MetadataJoinDiagnosticItem[];
  highlights: string[];
}

const FAILURE_LABELS: Record<MetadataJoinFailureClass, string> = {
  NOT_SELECTED_FOR_MARKET_DATA: 'Not selected for market-data lookup',
  MATCH_NOT_ATTEMPTED: 'Company matching not attempted',
  MARKET_DATA_NOT_FOUND: 'Market data lookup returned no company',
  NO_COMPANY_MATCH: 'No company identity',
  COMPANY_MATCH_NOT_LINKED: 'Company exists but item is not linked',
  COMPANY_LINK_MISMATCH: 'Linked company ticker mismatch',
  COMPANY_FOUND_METADATA_MISSING: 'Company metadata missing',
  SECTOR_MISSING: 'Sector missing',
  MARKET_CAP_MISSING: 'Market cap missing',
  EXCHANGE_MISSING: 'Exchange missing',
  SCORES_MISSING: 'Scoring data missing',
  COMPLETE: 'Complete',
};

const EXPLANATIONS: Record<MetadataJoinFailureClass, string> = {
  NOT_SELECTED_FOR_MARKET_DATA: 'The collection item was outside the limited market-data lookup selection.',
  MATCH_NOT_ATTEMPTED: 'The item was selected, but no market-data lookup attempt was recorded.',
  MARKET_DATA_NOT_FOUND: 'A market-data lookup was attempted but did not return a matched company.',
  NO_COMPANY_MATCH: 'No companies row matches the collection ticker.',
  COMPANY_MATCH_NOT_LINKED: 'A companies row matches the ticker, but collection_run_items.company_id is not linked to it.',
  COMPANY_LINK_MISMATCH: 'collection_run_items.company_id points to a company with a different ticker.',
  COMPANY_FOUND_METADATA_MISSING: 'The linked company exists, but none of the audited company metadata fields are populated.',
  SECTOR_MISSING: 'The linked company and exact decision provide no sector.',
  MARKET_CAP_MISSING: 'Neither the exact decision nor an observation-time local price snapshot provides market cap.',
  EXCHANGE_MISSING: 'The linked company provides no exchange.',
  SCORES_MISSING: 'No exact item-linked discovery decision contains scoring data.',
  COMPLETE: 'Company identity, item link, core metadata, market context, exchange, and scoring data are available.',
};

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentage(part: number, total: number): number {
  return total > 0 ? roundPercentage((part / total) * 100) : 0;
}

function sameTicker(left: string | null, right: string): boolean {
  return left?.trim().toUpperCase() === right.trim().toUpperCase();
}

export function classifyMetadataJoinItem(source: MetadataJoinSourceItem): MetadataJoinDiagnosticItem {
  const companyIdentityExists = source.tickerCompanyId != null || source.linkedCompanyId != null;
  const companyMatched = source.itemCompanyId != null
    && source.linkedCompanyId != null
    && sameTicker(source.linkedCompanyTicker, source.ticker);
  const scoringDataExists = source.decisionExists
    && (source.growthScoreExists || source.healthScoreExists || source.coverageScoreExists);
  const scoresComplete = source.growthScoreExists && source.healthScoreExists && source.coverageScoreExists;
  let firstFailure: MetadataJoinFailureClass;
  if (!source.selectedForMarketData && !companyIdentityExists) firstFailure = 'NOT_SELECTED_FOR_MARKET_DATA';
  else if (!source.marketDataAttempted && !companyIdentityExists) firstFailure = 'MATCH_NOT_ATTEMPTED';
  else if (!source.marketDataFound && !companyIdentityExists) firstFailure = 'MARKET_DATA_NOT_FOUND';
  else if (!companyIdentityExists) firstFailure = 'NO_COMPANY_MATCH';
  else if (!companyMatched && source.itemCompanyId == null) firstFailure = 'COMPANY_MATCH_NOT_LINKED';
  else if (!companyMatched) firstFailure = 'COMPANY_LINK_MISMATCH';
  else if (!source.companyMetadataExists) firstFailure = 'COMPANY_FOUND_METADATA_MISSING';
  else if (!source.sectorExists) firstFailure = 'SECTOR_MISSING';
  else if (!source.marketCapExists) firstFailure = 'MARKET_CAP_MISSING';
  else if (!source.exchangeExists) firstFailure = 'EXCHANGE_MISSING';
  else if (!scoringDataExists) firstFailure = 'SCORES_MISSING';
  else firstFailure = 'COMPLETE';
  return {
    ...source,
    companyIdentityExists,
    companyMatched,
    scoringDataExists,
    scoresComplete,
    finalResearchReady: firstFailure === 'COMPLETE',
    firstFailure,
    explanation: EXPLANATIONS[firstFailure],
  };
}

export function buildMetadataJoinRootCauseAudit(
  sourceItems: MetadataJoinSourceItem[],
  now = new Date(),
): MetadataJoinRootCauseAudit {
  const items = sourceItems.map(classifyMetadataJoinItem);
  const total = items.length;
  const count = (predicate: (item: MetadataJoinDiagnosticItem) => boolean) => items.filter(predicate).length;
  const stages: Array<[string, string, (item: MetadataJoinDiagnosticItem) => boolean]> = [
    ['collection_items', 'Collection items', () => true],
    ['company_identity', 'Company identity exists', (item) => item.companyIdentityExists],
    ['company_match', 'Collection item linked to company', (item) => item.companyMatched],
    ['company_metadata', 'Company metadata exists', (item) => item.companyMatched && item.companyMetadataExists],
    ['sector', 'Sector available', (item) => item.companyMatched && item.companyMetadataExists && item.sectorExists],
    ['market_cap', 'Market cap available', (item) => item.companyMatched && item.companyMetadataExists && item.sectorExists && item.marketCapExists],
    ['exchange', 'Exchange available', (item) => item.companyMatched && item.companyMetadataExists && item.sectorExists && item.marketCapExists && item.exchangeExists],
    ['scoring', 'Scoring data available', (item) => item.companyMatched && item.companyMetadataExists && item.sectorExists && item.marketCapExists && item.exchangeExists && item.scoringDataExists],
    ['final_research', 'Final research view ready', (item) => item.finalResearchReady],
  ];
  let previous = total;
  const funnel = stages.map(([key, label, predicate]) => {
    const stageCount = count(predicate);
    const stage = {
      key,
      label,
      count: stageCount,
      percentageOfItems: percentage(stageCount, total),
      droppedFromPrevious: previous - stageCount,
    };
    previous = stageCount;
    return stage;
  });
  const failureOrder: MetadataJoinFailureClass[] = [
    'NOT_SELECTED_FOR_MARKET_DATA',
    'MATCH_NOT_ATTEMPTED',
    'MARKET_DATA_NOT_FOUND',
    'NO_COMPANY_MATCH',
    'COMPANY_MATCH_NOT_LINKED',
    'COMPANY_LINK_MISMATCH',
    'COMPANY_FOUND_METADATA_MISSING',
    'SECTOR_MISSING',
    'MARKET_CAP_MISSING',
    'EXCHANGE_MISSING',
    'SCORES_MISSING',
    'COMPLETE',
  ];
  const failures = failureOrder
    .map((failureClass) => {
      const failureCount = count((item) => item.firstFailure === failureClass);
      return {
        failureClass,
        label: FAILURE_LABELS[failureClass],
        count: failureCount,
        percentage: percentage(failureCount, total),
      };
    })
    .filter((failure) => failure.count > 0);
  const summary: MetadataJoinSummary = {
    totalItems: total,
    selectedCount: count((item) => item.selectedForMarketData),
    matchAttemptedCount: count((item) => item.marketDataAttempted),
    marketDataFoundCount: count((item) => item.marketDataFound),
    companyIdentityCount: count((item) => item.companyIdentityExists),
    companyMatchedCount: count((item) => item.companyMatched),
    exactDecisionCount: count((item) => item.decisionExists),
    companyScoreSnapshotCount: count((item) => item.companyScoreSnapshotExists),
    scoringDataCount: count((item) => item.scoringDataExists),
    completeCount: count((item) => item.finalResearchReady),
    decisionScoresWithoutCompanyLinkCount: count((item) => item.scoringDataExists && !item.companyMatched),
    unselectedIdentityCount: count((item) => !item.selectedForMarketData && item.companyIdentityExists),
    marketDataFoundWithoutIdentityCount: count((item) => item.marketDataFound && !item.companyIdentityExists),
  };
  const highlights: string[] = [];
  if (total) {
    const largestFailure = failures
      .filter((failure) => failure.failureClass !== 'COMPLETE')
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0];
    if (largestFailure) {
      highlights.push(`The largest first failure is ${largestFailure.label.toLowerCase()}: ${largestFailure.count} items (${largestFailure.percentage.toFixed(1)}%).`);
    }
    if (summary.unselectedIdentityCount) {
      highlights.push(`${summary.unselectedIdentityCount} unselected items already have a company row by ticker, so skipping a fresh lookup did not erase their identity.`);
    }
    if (summary.marketDataFoundWithoutIdentityCount) {
      highlights.push(`${summary.marketDataFoundWithoutIdentityCount} items recorded market data as found but have no current company identity by ticker or item link.`);
    }
    if (summary.decisionScoresWithoutCompanyLinkCount) {
      highlights.push(`${summary.decisionScoresWithoutCompanyLinkCount} items have exact decision scoring data despite a missing or invalid collection-item company link.`);
    }
    highlights.push(`${summary.completeCount} of ${total} items reach the complete research-metadata stage (${percentage(summary.completeCount, total).toFixed(1)}%).`);
  }
  return {
    generatedAt: now.toISOString(),
    sampleUnit: 'collection_run_item row',
    summary,
    funnel,
    failures,
    items,
    highlights,
  };
}

export async function getMetadataJoinRootCauseAudit(now = new Date()): Promise<MetadataJoinRootCauseAudit> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await client.query(
      `SELECT
         i.id AS item_id,
         i.collection_run_id AS run_id,
         i.ticker,
         i.observed_at,
         i.lookup_bucket,
         i.selected_for_market_data,
         i.market_data_attempted,
         i.company_id AS item_company_id,
         i.market_data_found,
         i.skip_reason,
         linked.id AS linked_company_id,
         linked.ticker AS linked_company_ticker,
         ticker_company.id AS ticker_company_id,
         (
           NULLIF(btrim(linked.name), '') IS NOT NULL
           OR NULLIF(btrim(linked.quote_type), '') IS NOT NULL
           OR NULLIF(btrim(linked.currency), '') IS NOT NULL
           OR NULLIF(btrim(linked.source), '') IS NOT NULL
           OR NULLIF(btrim(linked.sec_cik), '') IS NOT NULL
           OR NULLIF(btrim(linked.sector), '') IS NOT NULL
           OR NULLIF(btrim(linked.industry), '') IS NOT NULL
           OR NULLIF(btrim(linked.exchange), '') IS NOT NULL
         ) AS company_metadata_exists,
         COALESCE(NULLIF(btrim(decision.sector), ''), NULLIF(btrim(linked.sector), '')) IS NOT NULL AS sector_exists,
         COALESCE(decision.market_cap, price.market_cap) IS NOT NULL AS market_cap_exists,
         NULLIF(btrim(linked.exchange), '') IS NOT NULL AS exchange_exists,
         decision.id IS NOT NULL AS decision_exists,
         score.id IS NOT NULL AS company_score_snapshot_exists,
         decision.growth_score IS NOT NULL AS growth_score_exists,
         decision.health_score IS NOT NULL AS health_score_exists,
         decision.coverage_score IS NOT NULL AS coverage_score_exists
       FROM collection_run_items i
       LEFT JOIN companies linked ON linked.id = i.company_id
       LEFT JOIN LATERAL (
         SELECT c.id
         FROM companies c
         WHERE upper(c.ticker) = upper(i.ticker)
         ORDER BY c.id
         LIMIT 1
       ) ticker_company ON true
       LEFT JOIN LATERAL (
         SELECT dd.*
         FROM discovery_decisions dd
         WHERE dd.collection_run_item_id = i.id
         ORDER BY dd.id DESC
         LIMIT 1
       ) decision ON true
       LEFT JOIN LATERAL (
         SELECT p.market_cap
         FROM price_snapshots p
         WHERE p.company_id = i.company_id
           AND p.captured_at <= i.observed_at
         ORDER BY p.captured_at DESC, p.id DESC
         LIMIT 1
       ) price ON true
       LEFT JOIN LATERAL (
         SELECT s.id
         FROM companies score_company
         JOIN company_score_snapshots s ON s.company_id = score_company.id
         WHERE upper(score_company.ticker) = upper(i.ticker)
           AND s.calculated_at <= i.observed_at
         ORDER BY s.calculated_at DESC, s.id DESC
         LIMIT 1
       ) score ON true
       ORDER BY i.observed_at, i.id`,
    );
    await client.query('COMMIT');
    return buildMetadataJoinRootCauseAudit(result.rows.map((row) => ({
      itemId: Number(row.item_id),
      runId: Number(row.run_id),
      ticker: String(row.ticker),
      observedAt: new Date(row.observed_at).toISOString(),
      lookupBucket: String(row.lookup_bucket),
      selectedForMarketData: Boolean(row.selected_for_market_data),
      marketDataAttempted: Boolean(row.market_data_attempted),
      skipReason: row.skip_reason == null ? null : String(row.skip_reason),
      itemCompanyId: row.item_company_id == null ? null : Number(row.item_company_id),
      linkedCompanyId: row.linked_company_id == null ? null : Number(row.linked_company_id),
      linkedCompanyTicker: row.linked_company_ticker == null ? null : String(row.linked_company_ticker),
      tickerCompanyId: row.ticker_company_id == null ? null : Number(row.ticker_company_id),
      marketDataFound: Boolean(row.market_data_found),
      companyMetadataExists: Boolean(row.company_metadata_exists),
      sectorExists: Boolean(row.sector_exists),
      marketCapExists: Boolean(row.market_cap_exists),
      exchangeExists: Boolean(row.exchange_exists),
      decisionExists: Boolean(row.decision_exists),
      companyScoreSnapshotExists: Boolean(row.company_score_snapshot_exists),
      growthScoreExists: Boolean(row.growth_score_exists),
      healthScoreExists: Boolean(row.health_score_exists),
      coverageScoreExists: Boolean(row.coverage_score_exists),
    })), now);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
