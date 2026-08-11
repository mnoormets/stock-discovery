import { ensureSchema, pool, type DailyAlertKind } from './db';
import type { CompanyScore, CompanyScores, ScoreComponent } from './company-scores';

export const SCORE_ALERT_THRESHOLD = 10;

type ScoreBand = 'positive' | 'neutral' | 'negative' | 'missing';
type ChangeDirection = 'improved' | 'degraded' | 'changed';

interface StoredScoreSnapshot {
  id: number;
  version: string;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  scores: CompanyScores;
  calculatedAt: string;
}

export interface ScoreValueChange {
  previous: number | null;
  current: number | null;
  delta: number | null;
}

export interface ScoreComponentChange {
  scoreKind: 'Growth' | 'Financial Health';
  componentId: string;
  label: string;
  weight: number;
  previous: number | null;
  current: number | null;
  delta: number | null;
  previousBand: ScoreBand;
  currentBand: ScoreBand;
  direction: ChangeDirection;
  significant: boolean;
}

export interface ScoreReview {
  positionId: number;
  companyId: number;
  ticker: string;
  label: DailyAlertKind;
  comparable: boolean;
  significant: boolean;
  modelVersionChanged: boolean;
  modelVersion: string | null;
  currentSnapshotId: number | null;
  previousSnapshotId: number | null;
  currentCalculatedAt: string | null;
  previousCalculatedAt: string | null;
  growth: ScoreValueChange | null;
  health: ScoreValueChange | null;
  coverage: ScoreValueChange | null;
  componentChanges: ScoreComponentChange[];
  summary: string;
}

function band(value: number | null): ScoreBand {
  if (value == null) return 'missing';
  if (value >= 65) return 'positive';
  if (value < 40) return 'negative';
  return 'neutral';
}

function valueChange(previous: number | null, current: number | null): ScoreValueChange {
  return {
    previous,
    current,
    delta: previous == null || current == null ? null : current - previous,
  };
}

function components(score: CompanyScore | null | undefined): Map<string, ScoreComponent> {
  return new Map((score?.components || []).map((component) => [component.id, component]));
}

function compareComponents(
  scoreKind: ScoreComponentChange['scoreKind'],
  previous: CompanyScore | null | undefined,
  current: CompanyScore | null | undefined,
): ScoreComponentChange[] {
  const before = components(previous);
  const after = components(current);
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].flatMap((componentId) => {
    const oldComponent = before.get(componentId);
    const newComponent = after.get(componentId);
    const oldScore = oldComponent?.score ?? null;
    const newScore = newComponent?.score ?? null;
    if (oldScore === newScore) return [];
    const delta = oldScore == null || newScore == null ? null : newScore - oldScore;
    const previousBand = band(oldScore);
    const currentBand = band(newScore);
    // Uue või kadunud komponendi suunda ei oletata: katvuse muutus vajab ülevaatust,
    // kuid ei ole iseenesest positiivne katalüsaator ega uus risk.
    const direction: ChangeDirection = delta == null
      ? 'changed'
      : delta > 0 ? 'improved' : delta < 0 ? 'degraded' : 'changed';
    const stateChanged = previousBand !== currentBand;
    const weight = newComponent?.weight ?? oldComponent?.weight ?? 0;
    return [{
      scoreKind,
      componentId,
      label: newComponent?.label || oldComponent?.label || componentId,
      weight,
      previous: oldScore,
      current: newScore,
      delta,
      previousBand,
      currentBand,
      direction,
      significant: (stateChanged && (delta == null || Math.abs(delta) >= SCORE_ALERT_THRESHOLD))
        || (delta == null && weight >= 15),
    }];
  }).sort((a, b) => {
    if (a.significant !== b.significant) return a.significant ? -1 : 1;
    const magnitudeA = a.delta == null ? a.weight : Math.abs(a.delta);
    const magnitudeB = b.delta == null ? b.weight : Math.abs(b.delta);
    return magnitudeB - magnitudeA || b.weight - a.weight;
  });
}

function mapSnapshot(row: any): StoredScoreSnapshot {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return {
    id: Number(row.id),
    version: row.scoring_version,
    growthScore: row.growth_score == null ? null : Number(row.growth_score),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    coverageScore: Number(row.coverage_score),
    scores: payload?.scores || { growth: null, financialHealth: null, coverage: null },
    calculatedAt: new Date(row.calculated_at).toISOString(),
  };
}

function scoreText(name: string, change: ScoreValueChange): string | null {
  if (change.previous == null && change.current == null) return null;
  const delta = change.delta == null ? '' : ` (${change.delta >= 0 ? '+' : ''}${change.delta})`;
  return `${name} ${change.previous ?? '—'} → ${change.current ?? '—'}${delta}`;
}

function buildComparableReview(
  positionId: number,
  companyId: number,
  ticker: string,
  current: StoredScoreSnapshot,
  previous: StoredScoreSnapshot,
): ScoreReview {
  const growth = valueChange(previous.growthScore, current.growthScore);
  const health = valueChange(previous.healthScore, current.healthScore);
  const coverage = valueChange(previous.coverageScore, current.coverageScore);
  const componentChanges = [
    ...compareComponents('Growth', previous.scores.growth, current.scores.growth),
    ...compareComponents('Financial Health', previous.scores.financialHealth, current.scores.financialHealth),
  ];
  const significantOverall = [growth.delta, health.delta].some((delta) => delta != null && Math.abs(delta) >= SCORE_ALERT_THRESHOLD);
  const significantComponents = componentChanges.filter((change) => change.significant);
  const significant = significantOverall || significantComponents.length > 0;
  const directions = [
    ...(growth.delta != null && Math.abs(growth.delta) >= SCORE_ALERT_THRESHOLD ? [Math.sign(growth.delta)] : []),
    ...(health.delta != null && Math.abs(health.delta) >= SCORE_ALERT_THRESHOLD ? [Math.sign(health.delta)] : []),
    ...significantComponents.map((change) => change.direction === 'improved' ? 1 : change.direction === 'degraded' ? -1 : 0),
  ];
  const hasPositive = directions.some((direction) => direction > 0);
  const hasNegative = directions.some((direction) => direction < 0);
  const label: DailyAlertKind = !significant
    ? 'no major changes'
    : hasNegative && !hasPositive
      ? 'new risk'
      : hasPositive && !hasNegative
        ? 'new catalyst'
        : 'needs review';
  const scoreParts = [scoreText('Growth', growth), scoreText('Health', health)].filter(Boolean);
  const componentPart = significantComponents.length
    ? ` Olulised komponendid: ${significantComponents.slice(0, 4).map((change) => `${change.label} ${change.previous ?? '—'} → ${change.current ?? '—'}`).join('; ')}.`
    : '';
  const summary = significant
    ? `${scoreParts.join('; ')}.${componentPart}`
    : `Growth ja Financial Health ei muutunud vähemalt ${SCORE_ALERT_THRESHOLD} punkti ning olulist komponendi seisundimuutust ei leitud.`;
  return {
    positionId,
    companyId,
    ticker,
    label,
    comparable: true,
    significant,
    modelVersionChanged: false,
    modelVersion: current.version,
    currentSnapshotId: current.id,
    previousSnapshotId: previous.id,
    currentCalculatedAt: current.calculatedAt,
    previousCalculatedAt: previous.calculatedAt,
    growth,
    health,
    coverage,
    componentChanges,
    summary,
  };
}

function buildUncomparableReview(
  positionId: number,
  companyId: number,
  ticker: string,
  current: StoredScoreSnapshot | null,
  previous: StoredScoreSnapshot | null,
): ScoreReview {
  const modelVersionChanged = Boolean(current && previous && current.version !== previous.version);
  const summary = !current
    ? 'Score snapshot puudub; võrdlust ei saa veel teha.'
    : modelVersionChanged
      ? `Mudeliversioon muutus ${previous!.version} → ${current.version}; skoore ei käsitleta võrreldava muutusena.`
      : 'Võrdluseks pole veel kahte järjestikust sama mudeliversiooni snapshot’i.';
  return {
    positionId,
    companyId,
    ticker,
    label: 'needs review',
    comparable: false,
    significant: false,
    modelVersionChanged,
    modelVersion: current?.version || null,
    currentSnapshotId: current?.id || null,
    previousSnapshotId: previous?.id || null,
    currentCalculatedAt: current?.calculatedAt || null,
    previousCalculatedAt: previous?.calculatedAt || null,
    growth: null,
    health: null,
    coverage: null,
    componentChanges: [],
    summary,
  };
}

async function persistScoreAlert(review: ScoreReview): Promise<void> {
  if (!review.significant || !review.comparable || !review.currentSnapshotId || !review.previousSnapshotId) return;
  const dedupeKey = `score:${review.companyId}:${review.positionId}:${review.previousSnapshotId}:${review.currentSnapshotId}`;
  await pool.query(
    `INSERT INTO alerts
       (company_id, position_id, kind, severity, title, detail, occurred_at, dedupe_key, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT DO NOTHING`,
    [
      review.companyId,
      review.positionId,
      review.label,
      review.label === 'new risk' ? 'warning' : 'info',
      `${review.ticker}: oluline score-muutus vajab ülevaatust`,
      review.summary,
      review.currentCalculatedAt,
      dedupeKey,
      JSON.stringify({ type: 'score_change', ...review }),
    ],
  );
}

export async function evaluateScoreChanges(positionIds: number[]): Promise<Map<number, ScoreReview>> {
  const ids = [...new Set(positionIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  await ensureSchema();
  const result = await pool.query(
    `SELECT p.id AS position_id, p.company_id, p.ticker,
            s.id, s.scoring_version, s.growth_score, s.health_score,
            s.coverage_score, s.payload, s.calculated_at
     FROM portfolio_positions p
     LEFT JOIN LATERAL (
       SELECT * FROM company_score_snapshots
       WHERE company_id = p.company_id
       ORDER BY calculated_at DESC, id DESC
       LIMIT 2
     ) s ON true
     WHERE p.id = ANY($1::bigint[])
     ORDER BY p.id, s.calculated_at DESC NULLS LAST, s.id DESC NULLS LAST`,
    [ids],
  );
  const grouped = new Map<number, { companyId: number; ticker: string; snapshots: StoredScoreSnapshot[] }>();
  for (const row of result.rows) {
    const positionId = Number(row.position_id);
    const item = grouped.get(positionId) || {
      companyId: Number(row.company_id),
      ticker: row.ticker,
      snapshots: [],
    };
    if (row.id != null) item.snapshots.push(mapSnapshot(row));
    grouped.set(positionId, item);
  }
  const reviews = new Map<number, ScoreReview>();
  for (const [positionId, item] of grouped) {
    const [current, previous] = item.snapshots;
    const review = current && previous && current.version === previous.version
      ? buildComparableReview(positionId, item.companyId, item.ticker, current, previous)
      : buildUncomparableReview(positionId, item.companyId, item.ticker, current || null, previous || null);
    await persistScoreAlert(review);
    reviews.set(positionId, review);
  }
  return reviews;
}
