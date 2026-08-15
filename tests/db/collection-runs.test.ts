import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  failCollectionRun,
  executeCollectionRun,
  listCollectionRuns,
  startCollectionRun,
  succeedCollectionRun,
} from '../../src/lib/collection-runs';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

describe('collection_runs lifecycle', () => {
  it('loob iga katse jaoks eraldi running-kirje', async () => {
    const first = await startCollectionRun('api');
    const second = await startCollectionRun('api');
    expect(first).toMatchObject({ id: 1, trigger: 'api', status: 'running', finishedAt: null, durationMs: null });
    expect(second).toMatchObject({ id: 2, trigger: 'api', status: 'running' });
    expect(first.metrics).toEqual({ schemaVersion: 1 });
  });

  it('lõpetab runni success-seisus koos metricute ja kestusega', async () => {
    const started = await startCollectionRun('direct', { schemaVersion: 1, stage: 'started' });
    const finished = await succeedCollectionRun(started.id, {
      captureDate: '2026-08-15', scanned: 200, candidates: 43,
      providers: { yahooFundamentals: 40 },
    });
    expect(finished.status).toBe('success');
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.durationMs).toBeGreaterThanOrEqual(0);
    expect(finished.errorMessage).toBeNull();
    expect(finished.metrics).toEqual({
      schemaVersion: 1,
      stage: 'started',
      captureDate: '2026-08-15',
      scanned: 200,
      candidates: 43,
      providers: { yahooFundamentals: 40 },
    });
  });

  it('lõpetab püütud vea failure-seisus ja säilitab piiratud vea', async () => {
    const started = await startCollectionRun('direct');
    const finished = await failCollectionRun(started.id, new TypeError('provider timeout'), { stage: 'sources' });
    expect(finished).toMatchObject({
      status: 'failure', errorName: 'TypeError', errorMessage: 'provider timeout',
    });
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.durationMs).toBeGreaterThanOrEqual(0);
    expect(finished.metrics).toMatchObject({ schemaVersion: 1, stage: 'sources' });
  });

  it('kärbib veateate 2000 märgile', async () => {
    const started = await startCollectionRun();
    const finished = await failCollectionRun(started.id, new Error('x'.repeat(2500)));
    expect(finished.errorMessage).toHaveLength(2000);
  });

  it('sama terminalseisu kordus on idempotentne ega kirjuta aega või metricuid üle', async () => {
    const started = await startCollectionRun();
    const first = await succeedCollectionRun(started.id, { candidates: 5 });
    const second = await succeedCollectionRun(started.id, { candidates: 999 });
    expect(second).toEqual(first);
    expect(second.metrics).toMatchObject({ candidates: 5 });
  });

  it('ei luba success-runni failure-seisuks ümber kirjutada', async () => {
    const started = await startCollectionRun();
    await succeedCollectionRun(started.id);
    await expect(failCollectionRun(started.id, new Error('late error')))
      .rejects.toThrow('juba terminalseisus success');
  });

  it('DB piirangud keelavad vastuolulise lifecycle rea', async () => {
    await expect(pool.query(
      `INSERT INTO collection_runs (trigger, status, finished_at, metrics)
       VALUES ('test', 'success', NULL, '{}'::jsonb)`,
    )).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(
      `INSERT INTO collection_runs (trigger, metrics) VALUES ('test', '[]'::jsonb)`,
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('audit-list on uusim ees ja limiit on piiratud', async () => {
    await startCollectionRun('first');
    await startCollectionRun('second');
    const rows = await listCollectionRuns(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].trigger).toBe('second');
  });

  it('orkestreerija seob operatsiooni tulemuse success-metricutega', async () => {
    const execution = await executeCollectionRun({
      trigger: 'test-success',
      operation: async () => ({ scanned: 200 }),
      successMetrics: (result) => ({ schemaVersion: 1, scanned: result.scanned }),
    });
    expect(execution.run.status).toBe('success');
    expect(execution.run.metrics).toEqual({ schemaVersion: 1, scanned: 200 });
  });

  it('orkestreerija rethrowib algse vea pärast failure kirje salvestamist', async () => {
    const operationError = new Error('ape wisdom unavailable');
    await expect(executeCollectionRun({
      trigger: 'test-failure',
      operation: async () => { throw operationError; },
      successMetrics: () => ({ schemaVersion: 1 }),
    })).rejects.toBe(operationError);
    const [run] = await listCollectionRuns(1);
    expect(run).toMatchObject({
      trigger: 'test-failure', status: 'failure', errorMessage: 'ape wisdom unavailable',
    });
  });
});
