import { ensureSchema, pool, saveFundamentalsSnapshot } from './db';
import { fetchFmpFundamentals } from './fmp';
import { fetchFundamentals } from './yahoo';
import {
  DEFAULT_BENCHMARK_SYMBOL,
  OUTCOME_HORIZONS,
  refreshCandidateOutcomes,
  type OutcomeHorizon,
  type RunProvenanceUsage,
} from './discovery-validation';

export interface BacktestHorizonStats {
  horizon: OutcomeHorizon;
  runCount: number;
  candidateCount: number;
  measuredCount: number;
  averageReturn: number | null;
  medianReturn: number | null;
  hitRatePercent: number | null;
  beatBenchmarkPercent: number | null;
  averageExcessReturn: number | null;
  benchmarkMeasuredCount: number;
  best: { ticker: string; returnPercent: number } | null;
  worst: { ticker: string; returnPercent: number } | null;
}

export interface BacktestOutcome {
  horizon: OutcomeHorizon;
  status: string;
  candidateReturnPercent: number | null;
  measuredAt: string | null;
  benchmarkSymbol: string;
  benchmarkStatus: string;
  benchmarkPriceStart: number | null;
  benchmarkPriceEnd: number | null;
  benchmarkReturnPercent: number | null;
  excessReturnPercent: number | null;
}

export interface BacktestCandidate {
  id: number;
  ticker: string;
  rank: number | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  reasons: string[];
  risks: string[];
  unknowns: string[];
  outcomes: BacktestOutcome[];
}

export interface BacktestRun {
  id: number;
  runAt: string;
  modelVersion: string;
  includedCount: number;
  excludedCount: number;
  candidates: BacktestCandidate[];
}

export interface BacktestDashboard {
  benchmarkSymbol: string;
  totalRuns: number;
  hasMeasuredOutcomes: boolean;
  provenance: RunProvenanceUsage[];
  horizons: BacktestHorizonStats[];
  runs: BacktestRun[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return JSON.parse(value) as string[];
  return [];
}

function numberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

// Uses the existing Yahoo/FMP price layer. Failure is an honest missing benchmark,
// never a fabricated 0% return and never a reason to fail the whole daily collection.
export async function collectDefaultBenchmarkPrice(): Promise<boolean> {
  try {
    let benchmark = (await fetchFundamentals([DEFAULT_BENCHMARK_SYMBOL])).get(DEFAULT_BENCHMARK_SYMBOL);
    if (benchmark?.price == null && process.env.FMP_API_KEY) {
      benchmark = (await fetchFmpFundamentals([DEFAULT_BENCHMARK_SYMBOL], process.env.FMP_API_KEY)).get(DEFAULT_BENCHMARK_SYMBOL);
    }
    if (!benchmark || benchmark.price == null) return false;
    await saveFundamentalsSnapshot(benchmark);
    return true;
  } catch (error) {
    console.warn(`Benchmark ${DEFAULT_BENCHMARK_SYMBOL} hinna kogumine ebaõnnestus:`, (error as Error).message);
    return false;
  }
}

// Anti-cheat boundary for Backtest V1:
// - only persisted discovery_runs, discovery_decisions and candidate_outcomes are read;
// - today's scanner logic is never rerun to reselect historical candidates;
// - measured candidate/benchmark outcomes are immutable;
// - missing prices stay unknown (NULL), never synthetic zeroes;
// - a run with zero candidates remains a valid observed run.
export async function getBacktestDashboard(): Promise<BacktestDashboard> {
  await ensureSchema();
  await refreshCandidateOutcomes();
  const [countRows, provenanceRows, runRows, outcomeRows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM discovery_runs`),
    pool.query(
      `SELECT model_version, run_type, count(*)::int AS runs,
              COALESCE(sum(included_count), 0)::int AS candidates
       FROM discovery_runs GROUP BY model_version, run_type
       ORDER BY model_version DESC, run_type`,
    ),
    pool.query(
      `SELECT id, run_at, model_version, evaluated_count, included_count
       FROM discovery_runs ORDER BY run_at DESC, id DESC LIMIT 20`,
    ),
    pool.query(
      `SELECT r.id AS run_id, d.ticker, o.horizon, o.status, o.return_percent,
              o.benchmark_status, o.benchmark_return_percent, o.excess_return_percent
       FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id AND d.included = true
       JOIN discovery_runs r ON r.id = d.run_id`,
    ),
  ]);

  const runIds = runRows.rows.map((row) => Number(row.id));
  // The candidate query needs the already-fetched latest run IDs. Re-run only this
  // local persisted-data query; no scanner or market selection logic is invoked.
  const details = runIds.length
    ? await pool.query(
        `SELECT r.id AS run_id, d.id AS decision_id, d.ticker, d.candidate_rank,
                d.growth_score, d.health_score, d.coverage_score,
                d.reasons, d.risks, d.unknowns,
                o.horizon, o.status, o.return_percent, o.measured_at,
                o.benchmark_symbol, o.benchmark_status,
                o.benchmark_price_start, o.benchmark_price_end,
                o.benchmark_return_percent, o.excess_return_percent
         FROM discovery_runs r
         JOIN discovery_decisions d ON d.run_id = r.id AND d.included = true
         LEFT JOIN candidate_outcomes o ON o.decision_id = d.id
         WHERE r.id = ANY($1::bigint[])
         ORDER BY r.run_at DESC, r.id DESC, d.candidate_rank, d.ticker,
           CASE o.horizon WHEN '1w' THEN 1 WHEN '2w' THEN 2 WHEN '1m' THEN 3 WHEN '3m' THEN 4 ELSE 5 END`,
        [runIds],
      )
    : { rows: [] as Record<string, unknown>[] };
  const totalRuns = Number(countRows.rows[0]?.total || 0);
  const horizons = OUTCOME_HORIZONS.map((horizon): BacktestHorizonStats => {
    const rows = outcomeRows.rows.filter((row) => row.horizon === horizon);
    const measured = rows.filter((row) => row.status === 'measured' && row.return_percent != null);
    const returns = measured.map((row) => Number(row.return_percent));
    const benchmarkMeasured = measured.filter((row) =>
      row.benchmark_status === 'measured'
      && row.benchmark_return_percent != null
      && row.excess_return_percent != null,
    );
    const excessReturns = benchmarkMeasured.map((row) => Number(row.excess_return_percent));
    const ranked = measured
      .map((row) => ({ ticker: String(row.ticker), returnPercent: Number(row.return_percent) }))
      .sort((a, b) => b.returnPercent - a.returnPercent);
    return {
      horizon,
      runCount: totalRuns,
      candidateCount: rows.length,
      measuredCount: measured.length,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      medianReturn: median(returns),
      hitRatePercent: returns.length ? (returns.filter((value) => value > 0).length / returns.length) * 100 : null,
      beatBenchmarkPercent: excessReturns.length ? (excessReturns.filter((value) => value > 0).length / excessReturns.length) * 100 : null,
      averageExcessReturn: excessReturns.length ? excessReturns.reduce((sum, value) => sum + value, 0) / excessReturns.length : null,
      benchmarkMeasuredCount: benchmarkMeasured.length,
      best: ranked[0] || null,
      worst: ranked.length ? ranked[ranked.length - 1] : null,
    };
  });

  const detailRows = details.rows as any[];
  const runs: BacktestRun[] = runRows.rows.map((run) => {
    const rows = detailRows.filter((row) => Number(row.run_id) === Number(run.id));
    const candidateIds = [...new Set(rows.map((row) => Number(row.decision_id)))];
    return {
      id: Number(run.id),
      runAt: new Date(run.run_at).toISOString(),
      modelVersion: run.model_version,
      includedCount: Number(run.included_count),
      excludedCount: Math.max(0, Number(run.evaluated_count) - Number(run.included_count)),
      candidates: candidateIds.map((decisionId) => {
        const candidate = rows.find((row) => Number(row.decision_id) === decisionId);
        return {
          id: decisionId,
          ticker: candidate.ticker,
          rank: candidate.candidate_rank == null ? null : Number(candidate.candidate_rank),
          growthScore: numberOrNull(candidate.growth_score),
          healthScore: numberOrNull(candidate.health_score),
          coverageScore: Number(candidate.coverage_score),
          reasons: jsonArray(candidate.reasons),
          risks: jsonArray(candidate.risks),
          unknowns: jsonArray(candidate.unknowns),
          outcomes: rows
            .filter((row) => Number(row.decision_id) === decisionId && row.horizon)
            .map((outcome) => ({
              horizon: outcome.horizon as OutcomeHorizon,
              status: outcome.status,
              candidateReturnPercent: numberOrNull(outcome.return_percent),
              measuredAt: outcome.measured_at ? new Date(outcome.measured_at).toISOString() : null,
              benchmarkSymbol: outcome.benchmark_symbol || DEFAULT_BENCHMARK_SYMBOL,
              benchmarkStatus: outcome.benchmark_status || 'pending',
              benchmarkPriceStart: numberOrNull(outcome.benchmark_price_start),
              benchmarkPriceEnd: numberOrNull(outcome.benchmark_price_end),
              benchmarkReturnPercent: numberOrNull(outcome.benchmark_return_percent),
              excessReturnPercent: numberOrNull(outcome.excess_return_percent),
            })),
        };
      }),
    };
  });

  return {
    benchmarkSymbol: DEFAULT_BENCHMARK_SYMBOL,
    totalRuns,
    hasMeasuredOutcomes: horizons.some((horizon) => horizon.measuredCount > 0),
    provenance: provenanceRows.rows.map((row) => ({
      modelVersion: String(row.model_version),
      runType: String(row.run_type),
      runs: Number(row.runs),
      candidates: Number(row.candidates),
    })),
    horizons,
    runs,
  };
}
