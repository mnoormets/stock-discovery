import { createHash } from 'crypto';
import { ensureSchema, pool } from './db';
import type { DiscoveryCriterion } from './rklb-discovery';

export const DISCOVERY_MODEL_VERSION = 'rklb-discovery-v1';
export const OUTCOME_HORIZONS = ['1w', '2w', '1m', '3m', '6m'] as const;
export type OutcomeHorizon = (typeof OUTCOME_HORIZONS)[number];

export interface DiscoveryDecisionInput {
  companyId: number;
  ticker: string;
  included: boolean;
  candidateRank: number | null;
  exclusionReasons: string[];
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  decisionPrice: number | null;
  currency: string | null;
  marketCap: number | null;
  volume: number | null;
  priceSnapshotId: number | null;
  scoreSnapshotId: number | null;
  scoringVersion: string | null;
  runwayStatus: string;
  runwayDetail: string;
  catalystStatus: string;
  catalystType: string | null;
  catalystSourceId: string | null;
  catalystUrl: string | null;
  catalystAt: string | null;
  catalystDetail: string;
  risks: string[];
  unknowns: string[];
  reasons: string[];
  criteria: DiscoveryCriterion[];
  proofQuestions: string[];
}

export interface DiscoveryRunRecord {
  runId: number;
  created: boolean;
  decisionDate: string;
}

export interface ValidationOutcome {
  horizon: OutcomeHorizon;
  status: 'pending' | 'measured' | 'missing' | 'unavailable';
  targetAt: string;
  observedAt: string | null;
  observedPrice: number | null;
  returnPercent: number | null;
}

export interface ValidationDecision extends DiscoveryDecisionInput {
  id: number;
  outcomes: ValidationOutcome[];
}

export interface ValidationRun {
  id: number;
  decisionDate: string;
  runAt: string;
  modelVersion: string;
  evaluatedCount: number;
  includedCount: number;
  rules: string[];
  decisions: ValidationDecision[];
}

export interface HorizonValidationStats {
  horizon: OutcomeHorizon;
  candidateCount: number;
  observedCount: number;
  pendingCount: number;
  averageReturn: number | null;
  medianReturn: number | null;
  winnerCount: number;
  loserCount: number;
  flatCount: number;
  winnerPercent: number | null;
  loserPercent: number | null;
  best: { ticker: string; returnPercent: number } | null;
  worst: { ticker: string; returnPercent: number } | null;
}

export interface ValidationDashboard {
  totalRuns: number;
  totalCandidates: number;
  horizons: HorizonValidationStats[];
  runs: ValidationRun[];
}

function tallinnDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function inputHash(rules: string[], decisions: DiscoveryDecisionInput[]): string {
  const canonical = stableValue({
    rules,
    decisions: [...decisions].sort((a, b) => a.ticker.localeCompare(b.ticker)),
  });
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function horizonTarget(runAt: Date, horizon: OutcomeHorizon): Date {
  const target = new Date(runAt);
  if (horizon === '1w') target.setUTCDate(target.getUTCDate() + 7);
  if (horizon === '2w') target.setUTCDate(target.getUTCDate() + 14);
  const months = horizon === '1m' ? 1 : horizon === '3m' ? 3 : horizon === '6m' ? 6 : 0;
  if (months) {
    const originalDay = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(originalDay, lastDay));
  }
  return target;
}

export async function recordDiscoveryRun(
  rules: string[],
  decisions: DiscoveryDecisionInput[],
  runAt = new Date(),
): Promise<DiscoveryRunRecord> {
  await ensureSchema();
  const decisionDate = tallinnDate(runAt);
  const hash = inputHash(rules, decisions);
  const runKey = `${DISCOVERY_MODEL_VERSION}:${decisionDate}:${hash}`;
  const universe = decisions.map((decision) => decision.ticker).sort();
  const includedCount = decisions.filter((decision) => decision.included).length;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO discovery_runs
        (run_type, decision_date, run_at, model_version, input_hash, run_key, rules, universe, evaluated_count, included_count)
       VALUES ('rklb', $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
       ON CONFLICT (run_key) DO NOTHING
       RETURNING id`,
      [
        decisionDate,
        runAt.toISOString(),
        DISCOVERY_MODEL_VERSION,
        hash,
        runKey,
        JSON.stringify(rules),
        JSON.stringify(universe),
        decisions.length,
        includedCount,
      ],
    );
    const created = Boolean(inserted.rowCount);
    let runId = created ? Number(inserted.rows[0].id) : 0;
    if (!created) {
      const existing = await client.query('SELECT id FROM discovery_runs WHERE run_key = $1', [runKey]);
      runId = Number(existing.rows[0].id);
    }
    if (created) {
      for (const decision of decisions) {
        const decisionResult = await client.query(
          `INSERT INTO discovery_decisions
            (run_id, company_id, ticker, included, candidate_rank, exclusion_reasons,
             growth_score, health_score, coverage_score, decision_price, currency,
             market_cap, volume, price_snapshot_id, score_snapshot_id, scoring_version,
             runway_status, runway_detail, catalyst_status, catalyst_type,
             catalyst_source_id, catalyst_url, catalyst_at, catalyst_detail,
             risks, unknowns, reasons, criteria, proof_questions, payload)
           VALUES
            ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             $17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26::jsonb,$27::jsonb,
             $28::jsonb,$29::jsonb,$30::jsonb)
           RETURNING id`,
          [
            runId, decision.companyId, decision.ticker, decision.included, decision.candidateRank,
            JSON.stringify(decision.exclusionReasons), decision.growthScore, decision.healthScore,
            decision.coverageScore, decision.decisionPrice, decision.currency, decision.marketCap,
            decision.volume, decision.priceSnapshotId, decision.scoreSnapshotId, decision.scoringVersion,
            decision.runwayStatus, decision.runwayDetail, decision.catalystStatus, decision.catalystType,
            decision.catalystSourceId, decision.catalystUrl, decision.catalystAt, decision.catalystDetail,
            JSON.stringify(decision.risks), JSON.stringify(decision.unknowns), JSON.stringify(decision.reasons),
            JSON.stringify(decision.criteria), JSON.stringify(decision.proofQuestions), JSON.stringify(decision),
          ],
        );
        if (decision.included) {
          const decisionId = Number(decisionResult.rows[0].id);
          for (const horizon of OUTCOME_HORIZONS) {
            await client.query(
              `INSERT INTO candidate_outcomes (decision_id, horizon, target_at)
               VALUES ($1, $2, $3)`,
              [decisionId, horizon, horizonTarget(runAt, horizon).toISOString()],
            );
          }
        }
      }
    }
    await client.query('COMMIT');
    return { runId, created, decisionDate };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshCandidateOutcomes(now = new Date()): Promise<number> {
  await ensureSchema();
  const due = await pool.query(
    `SELECT o.id, o.target_at, d.company_id, d.decision_price
     FROM candidate_outcomes o
     JOIN discovery_decisions d ON d.id = o.decision_id
     WHERE o.status <> 'measured' AND o.target_at <= $1
     ORDER BY o.target_at, o.id`,
    [now.toISOString()],
  );
  let changed = 0;
  for (const row of due.rows) {
    const outcomeId = Number(row.id);
    const baseline = row.decision_price == null ? null : Number(row.decision_price);
    if (baseline == null || baseline <= 0 || row.company_id == null) {
      const result = await pool.query(
        `UPDATE candidate_outcomes SET status = 'unavailable', measured_at = $2
         WHERE id = $1 AND status <> 'measured'`,
        [outcomeId, now.toISOString()],
      );
      changed += result.rowCount || 0;
      continue;
    }
    const observed = await pool.query(
      `SELECT price, captured_at
       FROM price_snapshots
       WHERE company_id = $1 AND price IS NOT NULL
         AND captured_at >= $2 AND captured_at < $2::timestamptz + interval '7 days'
       ORDER BY captured_at ASC, id ASC LIMIT 1`,
      [Number(row.company_id), new Date(row.target_at).toISOString()],
    );
    if (observed.rowCount) {
      const price = Number(observed.rows[0].price);
      const returnPercent = ((price - baseline) / baseline) * 100;
      const result = await pool.query(
        `UPDATE candidate_outcomes
         SET status = 'measured', observed_at = $2, observed_price = $3,
             return_percent = $4, measured_at = $5
         WHERE id = $1 AND status <> 'measured'`,
        [outcomeId, new Date(observed.rows[0].captured_at).toISOString(), price, returnPercent, now.toISOString()],
      );
      changed += result.rowCount || 0;
    } else if (now.getTime() >= new Date(row.target_at).getTime() + 7 * 86_400_000) {
      const result = await pool.query(
        `UPDATE candidate_outcomes SET status = 'missing', measured_at = $2
         WHERE id = $1 AND status <> 'measured'`,
        [outcomeId, now.toISOString()],
      );
      changed += result.rowCount || 0;
    }
  }
  return changed;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jsonArray<T>(value: T[] | string | null): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return JSON.parse(value) as T[];
  return [];
}

export async function getValidationDashboard(): Promise<ValidationDashboard> {
  await ensureSchema();
  await refreshCandidateOutcomes();
  const [counts, outcomeRows, runRows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS runs, COALESCE(sum(included_count), 0)::int AS candidates FROM discovery_runs`),
    pool.query(
      `SELECT o.horizon, o.status, o.return_percent, d.ticker
       FROM candidate_outcomes o
       JOIN discovery_decisions d ON d.id = o.decision_id`,
    ),
    pool.query(
      `SELECT id, decision_date, run_at, model_version, evaluated_count, included_count, rules
       FROM discovery_runs ORDER BY run_at DESC, id DESC LIMIT 20`,
    ),
  ]);

  const horizons = OUTCOME_HORIZONS.map((horizon): HorizonValidationStats => {
    const rows = outcomeRows.rows.filter((row) => row.horizon === horizon);
    const measured = rows
      .filter((row) => row.status === 'measured' && row.return_percent != null)
      .map((row) => ({ ticker: String(row.ticker), returnPercent: Number(row.return_percent) }));
    const returns = measured.map((row) => row.returnPercent);
    const winnerCount = returns.filter((value) => value > 0).length;
    const loserCount = returns.filter((value) => value < 0).length;
    const flatCount = returns.filter((value) => value === 0).length;
    const ranked = [...measured].sort((a, b) => b.returnPercent - a.returnPercent);
    return {
      horizon,
      candidateCount: rows.length,
      observedCount: measured.length,
      pendingCount: rows.filter((row) => row.status !== 'measured').length,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      medianReturn: median(returns),
      winnerCount,
      loserCount,
      flatCount,
      winnerPercent: returns.length ? (winnerCount / returns.length) * 100 : null,
      loserPercent: returns.length ? (loserCount / returns.length) * 100 : null,
      best: ranked[0] || null,
      worst: ranked.length ? ranked[ranked.length - 1] : null,
    };
  });

  const runs: ValidationRun[] = [];
  for (const row of runRows.rows) {
    const decisions = await pool.query(
      `SELECT d.*,
        COALESCE(json_agg(json_build_object(
          'horizon', o.horizon, 'status', o.status, 'targetAt', o.target_at,
          'observedAt', o.observed_at, 'observedPrice', o.observed_price,
          'returnPercent', o.return_percent
        ) ORDER BY CASE o.horizon WHEN '1w' THEN 1 WHEN '2w' THEN 2 WHEN '1m' THEN 3 WHEN '3m' THEN 4 ELSE 5 END)
        FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS outcomes
       FROM discovery_decisions d
       LEFT JOIN candidate_outcomes o ON o.decision_id = d.id
       WHERE d.run_id = $1
       GROUP BY d.id
       ORDER BY d.included DESC, d.candidate_rank NULLS LAST, d.ticker`,
      [Number(row.id)],
    );
    runs.push({
      id: Number(row.id),
      decisionDate: String(row.decision_date).slice(0, 10),
      runAt: new Date(row.run_at).toISOString(),
      modelVersion: row.model_version,
      evaluatedCount: Number(row.evaluated_count),
      includedCount: Number(row.included_count),
      rules: jsonArray<string>(row.rules),
      decisions: decisions.rows.map((decision) => ({
        id: Number(decision.id),
        companyId: decision.company_id == null ? 0 : Number(decision.company_id),
        ticker: decision.ticker,
        included: decision.included,
        candidateRank: decision.candidate_rank == null ? null : Number(decision.candidate_rank),
        exclusionReasons: jsonArray<string>(decision.exclusion_reasons),
        growthScore: decision.growth_score == null ? null : Number(decision.growth_score),
        healthScore: decision.health_score == null ? null : Number(decision.health_score),
        coverageScore: Number(decision.coverage_score),
        decisionPrice: decision.decision_price == null ? null : Number(decision.decision_price),
        currency: decision.currency || null,
        marketCap: decision.market_cap == null ? null : Number(decision.market_cap),
        volume: decision.volume == null ? null : Number(decision.volume),
        priceSnapshotId: decision.price_snapshot_id == null ? null : Number(decision.price_snapshot_id),
        scoreSnapshotId: decision.score_snapshot_id == null ? null : Number(decision.score_snapshot_id),
        scoringVersion: decision.scoring_version || null,
        runwayStatus: decision.runway_status,
        runwayDetail: decision.runway_detail,
        catalystStatus: decision.catalyst_status,
        catalystType: decision.catalyst_type || null,
        catalystSourceId: decision.catalyst_source_id || null,
        catalystUrl: decision.catalyst_url || null,
        catalystAt: decision.catalyst_at ? new Date(decision.catalyst_at).toISOString() : null,
        catalystDetail: decision.catalyst_detail,
        risks: jsonArray<string>(decision.risks),
        unknowns: jsonArray<string>(decision.unknowns),
        reasons: jsonArray<string>(decision.reasons),
        criteria: jsonArray<DiscoveryCriterion>(decision.criteria),
        proofQuestions: jsonArray<string>(decision.proof_questions),
        outcomes: jsonArray<Record<string, unknown>>(decision.outcomes).map((outcome) => ({
          horizon: outcome.horizon as OutcomeHorizon,
          status: outcome.status as ValidationOutcome['status'],
          targetAt: new Date(outcome.targetAt as string).toISOString(),
          observedAt: outcome.observedAt ? new Date(outcome.observedAt as string).toISOString() : null,
          observedPrice: outcome.observedPrice == null ? null : Number(outcome.observedPrice),
          returnPercent: outcome.returnPercent == null ? null : Number(outcome.returnPercent),
        })),
      })),
    });
  }

  return {
    totalRuns: Number(counts.rows[0]?.runs || 0),
    totalCandidates: Number(counts.rows[0]?.candidates || 0),
    horizons,
    runs,
  };
}
