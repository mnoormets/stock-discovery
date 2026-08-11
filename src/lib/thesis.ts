import { createHash } from 'crypto';
import { ensureSchema, pool } from './db';

export type ThesisStatus = 'draft' | 'researching' | 'ready' | 'rejected';

export interface ThesisCardInput {
  summary: string;
  business: string;
  whyNow: string;
  moat: string;
  mispricing: string;
  catalyst: string;
  invalidation: string;
  twelveMonthCheckpoint: string;
  checkpointIsMeasurable: boolean;
  timeHorizon: string;
  status: ThesisStatus;
  scoreSnapshotId: number | null;
}

export interface ThesisVersion extends ThesisCardInput {
  id: number;
  version: number;
  createdAt: string;
  isCurrent: boolean;
  scoreVersion: string | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
}

export interface ThesisWorkspace {
  positionId: number;
  ticker: string;
  companyName: string | null;
  positionStatus: string;
  current: ThesisVersion | null;
  history: ThesisVersion[];
}

const TEXT_LIMIT = 5000;

function clean(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function canonicalize(input: ThesisCardInput): ThesisCardInput {
  return {
    summary: clean(input.summary),
    business: clean(input.business),
    whyNow: clean(input.whyNow),
    moat: clean(input.moat),
    mispricing: clean(input.mispricing),
    catalyst: clean(input.catalyst),
    invalidation: clean(input.invalidation),
    twelveMonthCheckpoint: clean(input.twelveMonthCheckpoint),
    checkpointIsMeasurable: Boolean(input.checkpointIsMeasurable),
    timeHorizon: clean(input.timeHorizon),
    status: input.status,
    scoreSnapshotId: input.scoreSnapshotId,
  };
}

function inputHash(input: ThesisCardInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function validateThesisCard(raw: ThesisCardInput): string | null {
  const input = canonicalize(raw);
  if (!['draft', 'researching', 'ready', 'rejected'].includes(input.status)) return 'Teesi staatus ei ole lubatud.';
  const values = [
    input.summary, input.business, input.whyNow, input.moat, input.mispricing,
    input.catalyst, input.invalidation, input.twelveMonthCheckpoint,
  ];
  if (values.some((value) => value.length > TEXT_LIMIT) || input.timeHorizon.length > 200) {
    return 'Üks teesi väljadest on liiga pikk.';
  }
  if (input.status === 'ready') {
    if (!input.invalidation) return 'Enne staatust “ready” kirjelda mõõdetav invalidation-tingimus.';
    if (!input.twelveMonthCheckpoint) return 'Enne staatust “ready” lisa 12 kuu kontrollpunkt.';
    if (!input.checkpointIsMeasurable) return 'Kinnita, et 12 kuu kontrollpunkti saab objektiivselt hinnata.';
    const checkpoint = input.twelveMonthCheckpoint.toLocaleLowerCase('et-EE');
    if (checkpoint === input.summary.toLocaleLowerCase('et-EE') || checkpoint === input.business.toLocaleLowerCase('et-EE')) {
      return '12 kuu kontrollpunkt peab erinema teesi kokkuvõttest ja ettevõtte kirjeldusest.';
    }
  }
  return null;
}

function mapVersion(row: any): ThesisVersion {
  return {
    id: Number(row.id),
    version: Number(row.version || 1),
    summary: row.thesis || '',
    business: row.business || '',
    whyNow: row.why_now || '',
    moat: row.moat || '',
    mispricing: row.mispricing || '',
    catalyst: row.catalyst || '',
    invalidation: row.invalidation || '',
    twelveMonthCheckpoint: row.twelve_month_checkpoint || '',
    checkpointIsMeasurable: Boolean(row.checkpoint_is_measurable),
    timeHorizon: row.time_horizon || '',
    status: (row.status || 'draft') as ThesisStatus,
    scoreSnapshotId: row.score_snapshot_id == null ? null : Number(row.score_snapshot_id),
    createdAt: new Date(row.created_at).toISOString(),
    isCurrent: Boolean(row.is_current),
    scoreVersion: row.scoring_version || null,
    growthScore: row.growth_score == null ? null : Number(row.growth_score),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    coverageScore: row.coverage_score == null ? null : Number(row.coverage_score),
  };
}

export async function getThesisWorkspace(positionId: number): Promise<ThesisWorkspace | null> {
  if (!Number.isInteger(positionId) || positionId <= 0) return null;
  await ensureSchema();
  const position = await pool.query(
    `SELECT p.id, p.ticker, p.status, c.name
     FROM portfolio_positions p
     LEFT JOIN companies c ON c.id = p.company_id
     WHERE p.id = $1`,
    [positionId],
  );
  if (!position.rowCount) return null;
  const { rows } = await pool.query(
    `SELECT t.*, s.scoring_version, s.growth_score, s.health_score, s.coverage_score
     FROM investment_theses t
     LEFT JOIN company_score_snapshots s ON s.id = t.score_snapshot_id
     WHERE t.position_id = $1
     ORDER BY t.version DESC, t.created_at DESC, t.id DESC`,
    [positionId],
  );
  const history = rows.map(mapVersion);
  return {
    positionId,
    ticker: position.rows[0].ticker,
    companyName: position.rows[0].name || null,
    positionStatus: position.rows[0].status,
    current: history.find((version) => version.isCurrent) || null,
    history,
  };
}

export async function saveThesisCard(positionId: number, raw: ThesisCardInput): Promise<{ created: boolean; version: number }> {
  if (!Number.isInteger(positionId) || positionId <= 0) throw new Error('Vigane positsiooni ID.');
  const input = canonicalize(raw);
  const validationError = validateThesisCard(input);
  if (validationError) throw new Error(validationError);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const position = await client.query(
      `SELECT id, company_id, ticker FROM portfolio_positions WHERE id = $1 FOR UPDATE`,
      [positionId],
    );
    if (!position.rowCount) throw new Error('Watchlisti või portfelli kirjet ei leitud.');

    let scoreSnapshotId = input.scoreSnapshotId;
    if (scoreSnapshotId != null) {
      const score = await client.query(
        `SELECT id FROM company_score_snapshots WHERE id = $1 AND company_id = $2`,
        [scoreSnapshotId, position.rows[0].company_id],
      );
      if (!score.rowCount) scoreSnapshotId = null;
    }
    const normalized = { ...input, scoreSnapshotId };
    const hash = inputHash(normalized);
    const current = await client.query(
      `SELECT id, version, content_hash, thesis FROM investment_theses
       WHERE position_id = $1 AND is_current = true
       ORDER BY version DESC, id DESC LIMIT 1 FOR UPDATE`,
      [positionId],
    );
    if (current.rows[0]?.content_hash === hash) {
      await client.query('COMMIT');
      return { created: false, version: Number(current.rows[0].version || 1) };
    }
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM investment_theses WHERE position_id = $1`,
      [positionId],
    );
    const version = Number(versionResult.rows[0].next_version);
    await client.query(`UPDATE investment_theses SET is_current = false WHERE position_id = $1 AND is_current = true`, [positionId]);
    await client.query(
      `INSERT INTO investment_theses
       (position_id, thesis, business, why_now, moat, mispricing, catalyst, invalidation,
        twelve_month_checkpoint, checkpoint_is_measurable, time_horizon, status, version,
        content_hash, score_snapshot_id, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true)`,
      [
        positionId, normalized.summary, normalized.business, normalized.whyNow,
        normalized.moat, normalized.mispricing, normalized.catalyst, normalized.invalidation,
        normalized.twelveMonthCheckpoint, normalized.checkpointIsMeasurable,
        normalized.timeHorizon || null, normalized.status, version, hash,
        normalized.scoreSnapshotId,
      ],
    );
    await client.query(
      `INSERT INTO thesis_change_events (position_id, previous_thesis, new_thesis, change_reason)
       VALUES ($1,$2,$3,$4)`,
      [positionId, current.rows[0]?.thesis || null, normalized.summary || null, `Thesis Builder v${version}`],
    );
    await client.query(`UPDATE portfolio_positions SET updated_at = now() WHERE id = $1`, [positionId]);
    await client.query('COMMIT');
    return { created: true, version };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
