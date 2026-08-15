import { pool } from './db';

export const COLLECTION_METRICS_VERSION = 1;
export type CollectionRunStatus = 'running' | 'success' | 'failure';
export type CollectionRunMetrics = Record<string, unknown>;

export interface CollectionRunRecord {
  id: number;
  trigger: string;
  status: CollectionRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  metrics: CollectionRunMetrics;
  errorName: string | null;
  errorMessage: string | null;
}

function mapRun(row: any): CollectionRunRecord {
  return {
    id: Number(row.id),
    trigger: String(row.trigger),
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    metrics: row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics) ? row.metrics : {},
    errorName: row.error_name || null,
    errorMessage: row.error_message || null,
  };
}

function normalizeTrigger(value: string): string {
  const trigger = value.trim().toLowerCase();
  if (!trigger || trigger.length > 64) throw new Error('Collection run trigger peab olema 1–64 märki.');
  return trigger;
}

function metricsJson(metrics: CollectionRunMetrics): string {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new Error('Collection run metrics peab olema JSON objekt.');
  }
  return JSON.stringify(metrics);
}

export async function startCollectionRun(
  trigger = 'direct',
  initialMetrics: CollectionRunMetrics = { schemaVersion: COLLECTION_METRICS_VERSION },
): Promise<CollectionRunRecord> {
  const { rows } = await pool.query(
    `INSERT INTO collection_runs (trigger, metrics)
     VALUES ($1, $2::jsonb)
     RETURNING *`,
    [normalizeTrigger(trigger), metricsJson(initialMetrics)],
  );
  return mapRun(rows[0]);
}

async function readCollectionRun(id: number): Promise<CollectionRunRecord | null> {
  const { rows } = await pool.query('SELECT * FROM collection_runs WHERE id = $1', [id]);
  return rows[0] ? mapRun(rows[0]) : null;
}

async function finishCollectionRun(
  id: number,
  status: Exclude<CollectionRunStatus, 'running'>,
  metrics: CollectionRunMetrics,
  error: Error | null,
): Promise<CollectionRunRecord> {
  const errorName = error ? String(error.name || 'Error').slice(0, 200) : null;
  const errorMessage = error ? String(error.message || error.name || 'Tundmatu viga').slice(0, 2000) : null;
  const { rows } = await pool.query(
    `UPDATE collection_runs
     SET status = $2,
         finished_at = clock_timestamp(),
         duration_ms = GREATEST(0, floor(extract(epoch FROM (clock_timestamp() - started_at)) * 1000)::bigint),
         metrics = metrics || $3::jsonb,
         error_name = $4,
         error_message = $5
     WHERE id = $1 AND status = 'running'
     RETURNING *`,
    [id, status, metricsJson(metrics), errorName, errorMessage],
  );
  if (rows[0]) return mapRun(rows[0]);

  const existing = await readCollectionRun(id);
  if (!existing) throw new Error(`Collection run #${id} ei leitud.`);
  if (existing.status === status) return existing; // sama terminalseisu kordus on idempotentne
  throw new Error(`Collection run #${id} on juba terminalseisus ${existing.status}.`);
}

export function succeedCollectionRun(
  id: number,
  metrics: CollectionRunMetrics = {},
): Promise<CollectionRunRecord> {
  return finishCollectionRun(id, 'success', metrics, null);
}

export function failCollectionRun(
  id: number,
  error: unknown,
  metrics: CollectionRunMetrics = {},
): Promise<CollectionRunRecord> {
  const normalized = error instanceof Error ? error : new Error(String(error || 'Tundmatu viga'));
  return finishCollectionRun(id, 'failure', metrics, normalized);
}

export async function listCollectionRuns(limit = 50): Promise<CollectionRunRecord[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit) || 50));
  const { rows } = await pool.query(
    `SELECT * FROM collection_runs ORDER BY started_at DESC, id DESC LIMIT $1`,
    [safeLimit],
  );
  return rows.map(mapRun);
}

export async function executeCollectionRun<T>(options: {
  trigger?: string;
  initialMetrics?: CollectionRunMetrics;
  operation: (run: CollectionRunRecord) => Promise<T>;
  successMetrics: (result: T) => CollectionRunMetrics;
}): Promise<{ run: CollectionRunRecord; result: T }> {
  const run = await startCollectionRun(options.trigger || 'direct', options.initialMetrics);
  try {
    const result = await options.operation(run);
    const finished = await succeedCollectionRun(run.id, options.successMetrics(result));
    return { run: finished, result };
  } catch (error) {
    try {
      await failCollectionRun(run.id, error);
    } catch (ledgerError) {
      console.error(`Collection run #${run.id} failure-state salvestamine ebaõnnestus:`, ledgerError);
    }
    throw error;
  }
}
