import { createHash } from 'node:crypto';
import { pool } from './db';
import type { CompanyFinancialSummary } from './company-financials';
import { calculateCompanyScores, SCORE_VERSION, type CompanyScores } from './company-scores';
import { normalizeTicker } from './investment';

export interface ScoreSnapshot {
  id: number;
  ticker: string;
  version: string;
  inputHash: string;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  scores: CompanyScores;
  sources: ScoreSourceTrace[];
  calculatedAt: string;
}

export interface ScoreSourceTrace {
  metric: string;
  latestFactId: number | null;
  latestPeriodEnd: string;
  latestValue: number;
  previousFactId: number | null;
  previousPeriodEnd: string | null;
  previousValue: number | null;
}

export interface TrackedCompanyScores {
  current: ScoreSnapshot | null;
  previous: ScoreSnapshot | null;
  history: ScoreSnapshot[];
}

let schemaPromise: Promise<void> | null = null;

export function ensureScoreTrackingSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS company_score_snapshots (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        scoring_version TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        growth_score INTEGER,
        health_score INTEGER,
        coverage_score INTEGER NOT NULL,
        payload JSONB NOT NULL,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (company_id, scoring_version, input_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_company_scores_company_time
        ON company_score_snapshots (company_id, calculated_at DESC, id DESC);
    `).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function sourceTrace(financials: CompanyFinancialSummary): ScoreSourceTrace[] {
  return Object.entries(financials.metrics).flatMap(([metric, summary]) => summary ? [{
    metric,
    latestFactId: summary.latest.id,
    latestPeriodEnd: summary.latest.periodEnd,
    latestValue: summary.latest.value,
    previousFactId: summary.previousComparable?.id ?? null,
    previousPeriodEnd: summary.previousComparable?.periodEnd ?? null,
    previousValue: summary.previousComparable?.value ?? null,
  }] : []);
}

function scoreInput(financials: CompanyFinancialSummary, scores: CompanyScores) {
  const sources = sourceTrace(financials).sort((a, b) => a.metric.localeCompare(b.metric));
  const inputHash = createHash('sha256').update(JSON.stringify({ version: SCORE_VERSION, ticker: financials.ticker, sources })).digest('hex');
  return { scores, sources, inputHash };
}

function mapSnapshot(row: any): ScoreSnapshot {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return {
    id: Number(row.id),
    ticker: row.ticker,
    version: row.scoring_version,
    inputHash: row.input_hash,
    growthScore: row.growth_score == null ? null : Number(row.growth_score),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    coverageScore: Number(row.coverage_score),
    scores: payload.scores,
    sources: Array.isArray(payload.sources) ? payload.sources : [],
    calculatedAt: new Date(row.calculated_at).toISOString(),
  };
}

export async function saveCompanyScoreSnapshot(financials: CompanyFinancialSummary): Promise<ScoreSnapshot> {
  await ensureScoreTrackingSchema();
  const scores = calculateCompanyScores(financials);
  const input = scoreInput(financials, scores);
  const result = await pool.query(
    `INSERT INTO company_score_snapshots
       (company_id, scoring_version, input_hash, growth_score, health_score, coverage_score, payload)
     SELECT id, $2, $3, $4, $5, $6, $7::jsonb FROM companies WHERE ticker = $1
     ON CONFLICT (company_id, scoring_version, input_hash) DO UPDATE SET
       payload = EXCLUDED.payload
     RETURNING id, scoring_version, input_hash, growth_score, health_score,
       coverage_score, payload, calculated_at`,
    [
      financials.ticker, SCORE_VERSION, input.inputHash,
      scores.growth?.score ?? null, scores.financialHealth?.score ?? null,
      scores.coverage.score, JSON.stringify({ scores, sources: input.sources }),
    ],
  );
  if (!result.rowCount) throw new Error(`Ettevõtet ${financials.ticker} ei leitud.`);
  return mapSnapshot({ ...result.rows[0], ticker: financials.ticker });
}

export async function saveCompanyScoreSnapshots(financials: CompanyFinancialSummary[]): Promise<void> {
  for (const financial of financials) await saveCompanyScoreSnapshot(financial);
}

export async function getTrackedCompanyScores(rawTicker: string, financials?: CompanyFinancialSummary | null): Promise<TrackedCompanyScores> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return { current: null, previous: null, history: [] };
  await ensureScoreTrackingSchema();
  if (financials) await saveCompanyScoreSnapshot(financials);
  const result = await pool.query(
    `SELECT s.*, c.ticker
     FROM company_score_snapshots s JOIN companies c ON c.id = s.company_id
     WHERE c.ticker = $1 AND s.scoring_version = $2
     ORDER BY s.calculated_at DESC, s.id DESC LIMIT 8`,
    [ticker, SCORE_VERSION],
  );
  const history = result.rows.map(mapSnapshot);
  return { current: history[0] || null, previous: history[1] || null, history };
}
