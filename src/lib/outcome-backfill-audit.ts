import { pool } from './db';
import { OUTCOME_ANALYSIS_SNAPSHOT_VERSION } from './outcome-analysis-snapshots';

export type BackfillHorizonKey = '30d' | '90d' | '180d';
export type BackfillMissingReason = 'Too recent' | 'Missing price data' | 'Already measured' | 'Eligible for backfill';

export interface OutcomeBackfillAuditSourceItem {
  itemId: number;
  runId: number;
  runStartedAt: string;
  symbol: string;
  observedAt: string;
  snapshot30d: boolean;
  snapshot90d: boolean;
  snapshot180d: boolean;
  price30d: boolean;
  price90d: boolean;
  price180d: boolean;
}

export interface OutcomeBackfillAuditSummary {
  totalItems: number;
  distinctSymbols: number;
  alreadyMeasuredSymbols: number;
  unmeasuredSymbols: number;
  eligible30dCount: number;
  eligible90dCount: number;
  eligible180dCount: number;
  tooRecentCount: number;
  missingPriceDataCount: number;
}

export interface OutcomeBackfillHorizonAudit {
  horizonKey: BackfillHorizonKey;
  horizonLabel: '30D' | '90D' | '180D';
  eligibleItemCount: number;
  alreadyMeasuredCount: number;
  missingSnapshotCount: number;
  tooRecentCount: number;
  missingPriceDataCount: number;
}

export interface OutcomeBackfillSymbolAudit {
  symbol: string;
  firstObservedAt: string;
  latestObservedAt: string;
  collectionItemCount: number;
  hasAnyOutcomeSnapshot: boolean;
  eligible30d: boolean;
  eligible90d: boolean;
  eligible180d: boolean;
  hasRequiredPriceData30d: boolean;
  hasRequiredPriceData90d: boolean;
  hasRequiredPriceData180d: boolean;
  measured30d: boolean;
  measured90d: boolean;
  measured180d: boolean;
  missingReason: BackfillMissingReason;
}

export interface OutcomeBackfillRunAudit {
  runId: number;
  createdAt: string;
  totalItems: number;
  eligible30d: number;
  eligible90d: number;
  eligible180d: number;
  alreadyMeasured: number;
  missingSnapshots: number;
  missingPriceData: number;
}

export interface OutcomeBackfillAudit {
  generatedAt: string;
  snapshotVersion: string;
  priceTableAvailable: boolean;
  pricePolicy: string;
  summary: OutcomeBackfillAuditSummary;
  horizons: OutcomeBackfillHorizonAudit[];
  symbols: OutcomeBackfillSymbolAudit[];
  runs: OutcomeBackfillRunAudit[];
  highlights: string[];
}

type HorizonDefinition = {
  key: BackfillHorizonKey;
  label: '30D' | '90D' | '180D';
  days: number;
  snapshot: keyof Pick<OutcomeBackfillAuditSourceItem, 'snapshot30d' | 'snapshot90d' | 'snapshot180d'>;
  price: keyof Pick<OutcomeBackfillAuditSourceItem, 'price30d' | 'price90d' | 'price180d'>;
};

const HORIZONS: HorizonDefinition[] = [
  { key: '30d', label: '30D', days: 30, snapshot: 'snapshot30d', price: 'price30d' },
  { key: '90d', label: '90D', days: 90, snapshot: 'snapshot90d', price: 'price90d' },
  { key: '180d', label: '180D', days: 180, snapshot: 'snapshot180d', price: 'price180d' },
];

const PRICE_POLICY = 'Positive baseline within 7 days on or before observed_at, plus the first positive price in the 7 days from the exact horizon target.';

function ageDays(observedAt: string, now: Date): number {
  const observed = new Date(observedAt);
  if (!Number.isFinite(observed.getTime())) return -1;
  return Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000));
}

function isEligible(item: OutcomeBackfillAuditSourceItem, horizon: HorizonDefinition, now: Date): boolean {
  return ageDays(item.observedAt, now) >= horizon.days;
}

function hasSnapshot(item: OutcomeBackfillAuditSourceItem, horizon: HorizonDefinition): boolean {
  return Boolean(item[horizon.snapshot]);
}

function hasPrice(item: OutcomeBackfillAuditSourceItem, horizon: HorizonDefinition): boolean {
  return Boolean(item[horizon.price]);
}

function symbolReason(items: OutcomeBackfillAuditSourceItem[], now: Date): BackfillMissingReason {
  const due = HORIZONS.flatMap((horizon) => items
    .filter((item) => isEligible(item, horizon, now))
    .map((item) => ({ item, horizon })));
  if (due.some(({ item, horizon }) => !hasSnapshot(item, horizon) && hasPrice(item, horizon))) {
    return 'Eligible for backfill';
  }
  if (due.some(({ item, horizon }) => !hasSnapshot(item, horizon) && !hasPrice(item, horizon))) {
    return 'Missing price data';
  }
  if (items.some((item) => HORIZONS.some((horizon) => hasSnapshot(item, horizon)))) {
    return 'Already measured';
  }
  return 'Too recent';
}

export function buildOutcomeBackfillAudit(
  items: OutcomeBackfillAuditSourceItem[],
  now = new Date(),
  priceTableAvailable = true,
): OutcomeBackfillAudit {
  const horizonStates = HORIZONS.map((horizon): OutcomeBackfillHorizonAudit => {
    const eligible = items.filter((item) => isEligible(item, horizon, now));
    const alreadyMeasuredCount = eligible.filter((item) => hasSnapshot(item, horizon)).length;
    return {
      horizonKey: horizon.key,
      horizonLabel: horizon.label,
      eligibleItemCount: eligible.length,
      alreadyMeasuredCount,
      missingSnapshotCount: eligible.length - alreadyMeasuredCount,
      tooRecentCount: items.length - eligible.length,
      missingPriceDataCount: eligible.filter((item) => !hasSnapshot(item, horizon) && !hasPrice(item, horizon)).length,
    };
  });

  const itemsBySymbol = new Map<string, OutcomeBackfillAuditSourceItem[]>();
  for (const item of items) {
    const symbol = item.symbol.trim().toUpperCase();
    itemsBySymbol.set(symbol, [...(itemsBySymbol.get(symbol) || []), item]);
  }
  const symbols = [...itemsBySymbol.entries()].map(([symbol, symbolItems]): OutcomeBackfillSymbolAudit => {
    const observed = symbolItems.map((item) => item.observedAt).sort();
    const horizonValue = (horizon: HorizonDefinition, field: 'eligible' | 'price' | 'measured') => {
      const eligibleItems = symbolItems.filter((item) => isEligible(item, horizon, now));
      if (field === 'eligible') return eligibleItems.length > 0;
      if (field === 'price') {
        const unmeasured = eligibleItems.filter((item) => !hasSnapshot(item, horizon));
        return unmeasured.length > 0 && unmeasured.every((item) => hasPrice(item, horizon));
      }
      return eligibleItems.length > 0 && eligibleItems.every((item) => hasSnapshot(item, horizon));
    };
    return {
      symbol,
      firstObservedAt: observed[0],
      latestObservedAt: observed[observed.length - 1],
      collectionItemCount: symbolItems.length,
      hasAnyOutcomeSnapshot: symbolItems.some((item) => HORIZONS.some((horizon) => hasSnapshot(item, horizon))),
      eligible30d: horizonValue(HORIZONS[0], 'eligible'),
      eligible90d: horizonValue(HORIZONS[1], 'eligible'),
      eligible180d: horizonValue(HORIZONS[2], 'eligible'),
      hasRequiredPriceData30d: horizonValue(HORIZONS[0], 'price'),
      hasRequiredPriceData90d: horizonValue(HORIZONS[1], 'price'),
      hasRequiredPriceData180d: horizonValue(HORIZONS[2], 'price'),
      measured30d: horizonValue(HORIZONS[0], 'measured'),
      measured90d: horizonValue(HORIZONS[1], 'measured'),
      measured180d: horizonValue(HORIZONS[2], 'measured'),
      missingReason: symbolReason(symbolItems, now),
    };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));

  const itemsByRun = new Map<number, OutcomeBackfillAuditSourceItem[]>();
  for (const item of items) itemsByRun.set(item.runId, [...(itemsByRun.get(item.runId) || []), item]);
  const runs = [...itemsByRun.entries()].map(([runId, runItems]): OutcomeBackfillRunAudit => {
    const opportunities = HORIZONS.flatMap((horizon) => runItems
      .filter((item) => isEligible(item, horizon, now))
      .map((item) => ({ item, horizon })));
    return {
      runId,
      createdAt: runItems[0].runStartedAt,
      totalItems: runItems.length,
      eligible30d: runItems.filter((item) => isEligible(item, HORIZONS[0], now)).length,
      eligible90d: runItems.filter((item) => isEligible(item, HORIZONS[1], now)).length,
      eligible180d: runItems.filter((item) => isEligible(item, HORIZONS[2], now)).length,
      alreadyMeasured: runItems.filter((item) => HORIZONS.some((horizon) => hasSnapshot(item, horizon))).length,
      missingSnapshots: opportunities.filter(({ item, horizon }) => !hasSnapshot(item, horizon)).length,
      missingPriceData: opportunities.filter(({ item, horizon }) => !hasSnapshot(item, horizon) && !hasPrice(item, horizon)).length,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.runId - a.runId);

  const measuredSymbols = symbols.filter((symbol) => symbol.hasAnyOutcomeSnapshot).length;
  const missingPriceItems = new Set<number>();
  for (const item of items) {
    if (HORIZONS.some((horizon) => isEligible(item, horizon, now)
      && !hasSnapshot(item, horizon) && !hasPrice(item, horizon))) missingPriceItems.add(item.itemId);
  }
  const summary: OutcomeBackfillAuditSummary = {
    totalItems: items.length,
    distinctSymbols: symbols.length,
    alreadyMeasuredSymbols: measuredSymbols,
    unmeasuredSymbols: symbols.length - measuredSymbols,
    eligible30dCount: horizonStates[0].eligibleItemCount,
    eligible90dCount: horizonStates[1].eligibleItemCount,
    eligible180dCount: horizonStates[2].eligibleItemCount,
    tooRecentCount: items.filter((item) => !isEligible(item, HORIZONS[0], now)).length,
    missingPriceDataCount: missingPriceItems.size,
  };

  const backfillableSymbols = symbols.filter((symbol) => symbol.missingReason === 'Eligible for backfill').length;
  const highlights: string[] = [];
  if (items.length) {
    highlights.push(`${summary.totalItems} collection items exist, but ${summary.alreadyMeasuredSymbols} distinct symbols have measured outcome snapshots.`);
    if (summary.eligible30dCount > 0) highlights.push(`${summary.eligible30dCount} items are old enough for 30D measurement.`);
    else highlights.push('No candidates are old enough for 30D measurement yet.');
    if (summary.eligible180dCount === 0) highlights.push('No candidates are old enough for 180D measurement yet.');
    if (backfillableSymbols > 0) highlights.push(`${backfillableSymbols} symbols currently have at least one due, unmeasured horizon with required local price data.`);
    else if (summary.eligible30dCount > 0 && summary.missingPriceDataCount > 0) {
      highlights.push('0 symbols are currently backfillable because no due unmeasured opportunity has complete required local price data.');
    }
  }

  return {
    generatedAt: now.toISOString(),
    snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
    priceTableAvailable,
    pricePolicy: PRICE_POLICY,
    summary,
    horizons: horizonStates,
    symbols,
    runs,
    highlights,
  };
}

function sourceQuery(withPrices: boolean): string {
  const priceColumns = withPrices
    ? `(
         EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at <= i.observed_at
           AND p.captured_at >= i.observed_at - interval '7 days')
         AND EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at >= i.observed_at + interval '30 days'
           AND p.captured_at < i.observed_at + interval '37 days')
       ) AS price_30d,
       (
         EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at <= i.observed_at
           AND p.captured_at >= i.observed_at - interval '7 days')
         AND EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at >= i.observed_at + interval '90 days'
           AND p.captured_at < i.observed_at + interval '97 days')
       ) AS price_90d,
       (
         EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at <= i.observed_at
           AND p.captured_at >= i.observed_at - interval '7 days')
         AND EXISTS (SELECT 1 FROM price_snapshots p WHERE p.company_id = i.company_id
           AND p.price > 0 AND p.captured_at >= i.observed_at + interval '180 days'
           AND p.captured_at < i.observed_at + interval '187 days')
       ) AS price_180d`
    : 'false AS price_30d, false AS price_90d, false AS price_180d';
  return `SELECT
     i.id AS item_id, i.ticker, i.observed_at, r.id AS run_id, r.started_at AS run_started_at,
     EXISTS (SELECT 1 FROM outcome_analysis_snapshots s
       WHERE s.collection_run_item_id = i.id AND s.snapshot_version = $1 AND s.horizon IN ('30d', '1m')) AS snapshot_30d,
     EXISTS (SELECT 1 FROM outcome_analysis_snapshots s
       WHERE s.collection_run_item_id = i.id AND s.snapshot_version = $1 AND s.horizon IN ('90d', '3m')) AS snapshot_90d,
     EXISTS (SELECT 1 FROM outcome_analysis_snapshots s
       WHERE s.collection_run_item_id = i.id AND s.snapshot_version = $1 AND s.horizon IN ('180d', '6m')) AS snapshot_180d,
     ${priceColumns}
   FROM collection_run_items i
   JOIN collection_runs r ON r.id = i.collection_run_id
   ORDER BY i.observed_at, i.id`;
}

export async function getOutcomeBackfillAudit(now = new Date()): Promise<OutcomeBackfillAudit> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tableCheck = await client.query(`SELECT to_regclass('public.price_snapshots') IS NOT NULL AS available`);
    const priceTableAvailable = Boolean(tableCheck.rows[0]?.available);
    const result = await client.query(sourceQuery(priceTableAvailable), [OUTCOME_ANALYSIS_SNAPSHOT_VERSION]);
    await client.query('COMMIT');
    return buildOutcomeBackfillAudit(result.rows.map((row) => ({
      itemId: Number(row.item_id),
      runId: Number(row.run_id),
      runStartedAt: new Date(row.run_started_at).toISOString(),
      symbol: String(row.ticker),
      observedAt: new Date(row.observed_at).toISOString(),
      snapshot30d: Boolean(row.snapshot_30d),
      snapshot90d: Boolean(row.snapshot_90d),
      snapshot180d: Boolean(row.snapshot_180d),
      price30d: Boolean(row.price_30d),
      price90d: Boolean(row.price_90d),
      price180d: Boolean(row.price_180d),
    })), now, priceTableAvailable);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
