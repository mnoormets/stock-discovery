import { pool } from './db';
import { OUTCOME_ANALYSIS_SNAPSHOT_VERSION } from './outcome-analysis-snapshots';

export type OutcomeAgeBucket = '0-30 days' | '31-90 days' | '91-180 days' | '180+ days';

export interface OutcomeCoverageSourceRow {
  runId: number;
  runStartedAt: string;
  itemId: number | null;
  ticker: string | null;
  observedAt: string | null;
  measured: boolean;
}

export interface OutcomeCoverageSummary {
  totalCandidates: number;
  measuredCandidates: number;
  missingOutcomes: number;
  coveragePct: number | null;
}

export interface OutcomeCoverageRun {
  runId: number;
  createdAt: string;
  candidateCount: number;
  measuredCount: number;
  missingCount: number;
  coveragePct: number | null;
}

export interface OutcomeCoverageAge {
  bucket: OutcomeAgeBucket;
  count: number;
  measured: number;
  missing: number;
  coveragePct: number | null;
}

export interface OutcomeCoverageReport {
  snapshotVersion: string;
  generatedAt: string;
  summary: OutcomeCoverageSummary;
  byRun: OutcomeCoverageRun[];
  byAgeBucket: OutcomeCoverageAge[];
  highlights: string[];
}

const AGE_BUCKETS: OutcomeAgeBucket[] = [
  '0-30 days',
  '31-90 days',
  '91-180 days',
  '180+ days',
];

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentage(measured: number, total: number): number | null {
  return total > 0 ? roundPercentage((measured / total) * 100) : null;
}

function ageBucket(observedAt: string, now: Date): OutcomeAgeBucket {
  const observed = new Date(observedAt);
  const ageDays = Number.isFinite(observed.getTime())
    ? Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000))
    : 0;
  if (ageDays <= 30) return '0-30 days';
  if (ageDays <= 90) return '31-90 days';
  if (ageDays <= 180) return '91-180 days';
  return '180+ days';
}

function tallinnDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown date';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function coverageText(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function buildOutcomeCoverage(
  rows: OutcomeCoverageSourceRow[],
  now = new Date(),
): OutcomeCoverageReport {
  const runMap = new Map<number, OutcomeCoverageRun>();
  const ageMap = new Map<OutcomeAgeBucket, OutcomeCoverageAge>(AGE_BUCKETS.map((bucket) => [bucket, {
    bucket,
    count: 0,
    measured: 0,
    missing: 0,
    coveragePct: null,
  }]));
  const measuredSymbols = new Set<string>();
  let totalCandidates = 0;

  for (const row of rows) {
    if (!runMap.has(row.runId)) {
      runMap.set(row.runId, {
        runId: row.runId,
        createdAt: row.runStartedAt,
        candidateCount: 0,
        measuredCount: 0,
        missingCount: 0,
        coveragePct: null,
      });
    }
    if (row.itemId == null) continue;

    totalCandidates += 1;
    const run = runMap.get(row.runId)!;
    run.candidateCount += 1;
    if (row.measured) {
      run.measuredCount += 1;
      const symbol = row.ticker?.trim().toUpperCase();
      if (symbol) measuredSymbols.add(symbol);
    }

    const bucket = ageBucket(row.observedAt || row.runStartedAt, now);
    const age = ageMap.get(bucket)!;
    age.count += 1;
    if (row.measured) age.measured += 1;
  }

  const byRun = [...runMap.values()]
    .map((run) => ({
      ...run,
      missingCount: run.candidateCount - run.measuredCount,
      coveragePct: percentage(run.measuredCount, run.candidateCount),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.runId - a.runId);
  const byAgeBucket = AGE_BUCKETS.map((bucket) => {
    const age = ageMap.get(bucket)!;
    return {
      ...age,
      missing: age.count - age.measured,
      coveragePct: percentage(age.measured, age.count),
    };
  });
  const measuredCandidates = measuredSymbols.size;
  const summary = {
    totalCandidates,
    measuredCandidates,
    missingOutcomes: totalCandidates - measuredCandidates,
    coveragePct: percentage(measuredCandidates, totalCandidates),
  };

  const highlights: string[] = [];
  if (summary.coveragePct != null) {
    highlights.push(`Coverage currently ${coverageText(summary.coveragePct)}.`);
  }
  const oldestUncovered = [...byAgeBucket].reverse().find((bucket) => bucket.missing > 0);
  if (oldestUncovered) {
    highlights.push(`Oldest uncovered bucket: ${oldestUncovered.bucket} (${oldestUncovered.missing} missing).`);
  }
  const bestCoveredRun = byRun
    .filter((run) => run.candidateCount > 0 && run.coveragePct != null)
    .sort((a, b) => b.coveragePct! - a.coveragePct!
      || b.measuredCount - a.measuredCount
      || b.createdAt.localeCompare(a.createdAt)
      || b.runId - a.runId)[0];
  if (bestCoveredRun) {
    highlights.push(`Best covered run: ${tallinnDate(bestCoveredRun.createdAt)} (${coverageText(bestCoveredRun.coveragePct!)}, ${bestCoveredRun.measuredCount}/${bestCoveredRun.candidateCount}).`);
  }

  return {
    snapshotVersion: OUTCOME_ANALYSIS_SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    summary,
    byRun,
    byAgeBucket,
    highlights,
  };
}

export async function getOutcomeCoverage(now = new Date()): Promise<OutcomeCoverageReport> {
  const { rows } = await pool.query(
    `SELECT
       r.id AS run_id,
       r.started_at AS run_started_at,
       i.id AS item_id,
       i.ticker,
       i.observed_at,
       CASE WHEN i.id IS NULL THEN false ELSE EXISTS (
         SELECT 1
         FROM outcome_analysis_snapshots s
         WHERE s.collection_run_item_id = i.id
           AND s.snapshot_version = $1
       ) END AS measured
     FROM collection_runs r
     LEFT JOIN collection_run_items i ON i.collection_run_id = r.id
     ORDER BY r.started_at DESC, r.id DESC, i.id`,
    [OUTCOME_ANALYSIS_SNAPSHOT_VERSION],
  );
  return buildOutcomeCoverage(rows.map((row) => ({
    runId: Number(row.run_id),
    runStartedAt: new Date(row.run_started_at).toISOString(),
    itemId: row.item_id == null ? null : Number(row.item_id),
    ticker: row.ticker == null ? null : String(row.ticker),
    observedAt: row.observed_at == null ? null : new Date(row.observed_at).toISOString(),
    measured: Boolean(row.measured),
  })), now);
}
