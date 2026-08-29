import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  CONNECTION_TIMEOUT_MS,
  SCHEMA_VERSION,
  STATEMENT_TIMEOUT_MS,
  buildObservationReport,
  captureQueueSnapshot,
  observerPoolConfig,
  parseArgs,
  renderNdjson,
} from '../../scripts/report-companyfacts-queue.cjs';

function snapshot(phase: 'before' | 'after', ids: number[], intervalAttempts: unknown[] = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    recordType: 'snapshot',
    phase,
    observedAt: phase === 'before' ? '2026-08-26T05:09:00.000Z' : '2026-08-26T05:14:00.000Z',
    tallinnDate: '2026-08-26',
    databaseName: 'neondb',
    queue: {
      eligibleDepth: ids.length,
      missingFacts: ids.length,
      staleFacts: 0,
      neverAttempted: ids.length,
      oldestNeverAttempted: ids.length ? { ageDays: 4 } : null,
      orderedEligible: ids.map((companyId) => ({ companyId, ticker: `T${companyId}` })),
    },
    attemptsToday: { success: phase === 'before' ? 0 : 1, unavailable: 0, error: 0, total: phase === 'before' ? 0 : 1 },
    intervalAttempts,
    limitations: [],
  };
}

describe('CompanyFacts queue observation CLI', () => {
  it('bounds database connection and statement execution time', () => {
    expect(CONNECTION_TIMEOUT_MS).toBe(10_000);
    expect(STATEMENT_TIMEOUT_MS).toBe(30_000);
    expect(observerPoolConfig('postgres://example')).toEqual({
      connectionString: 'postgres://example',
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    });
  });

  it('parses bounded before/after artifact arguments and rejects unknown flags', () => {
    expect(parseArgs(['--phase', 'before', '--output', 'before.json'])).toMatchObject({
      phase: 'before', output: 'before.json', collectorStatus: 'unknown', collectorMode: 'live',
    });
    expect(parseArgs(['--phase', 'after', '--before', 'before.json', '--collector-status', 'failure', '--collector-mode', 'live']))
      .toMatchObject({ phase: 'after', before: 'before.json', collectorStatus: 'failure' });
    expect(() => parseArgs(['--phase', 'after', '--write-db'])).toThrow('Tundmatu argument');
  });

  it('derives after-only and same-run-serviced entrants without double counting', () => {
    const before = snapshot('before', [1, 2]);
    const after = snapshot('after', [2, 3], [
      { companyId: 1, ticker: 'T1', status: 'success' },
      { companyId: 4, ticker: 'T4', status: 'unavailable' },
    ]);
    const report = buildObservationReport(before, after, 'success', 'live');
    expect(report.validity).toMatchObject({ status: 'valid', excludeFromNormalThroughputPercentiles: false });
    expect(report.deltas.eligibleDepth).toBe(0);
    expect(report.interval.attempts).toEqual({ success: 1, unavailable: 1, error: 0, total: 2 });
    expect(report.interval.remainingEntrants).toEqual([{ companyId: 3, ticker: 'T3' }]);
    expect(report.interval.entrantAndServicedInSameRun).toEqual([{ companyId: 4, ticker: 'T4' }]);
    expect(report.interval.observedNewEligibleEntrants).toEqual([
      { companyId: 3, ticker: 'T3' }, { companyId: 4, ticker: 'T4' },
    ]);
    expect(renderNdjson(report).trim().split('\n')).toHaveLength(3);
  });

  it('marks failed, dry-run, and missing-before observations partial', () => {
    expect(buildObservationReport(null, snapshot('after', []), 'failure', 'live').validity).toMatchObject({
      status: 'partial',
      exclusionReasons: ['missing_before_snapshot', 'collector_failure'],
    });
    expect(buildObservationReport(snapshot('before', []), snapshot('after', []), 'success', 'dry_run')
      .validity.exclusionReasons).toContain('dry_run');
  });

  it('uses an explicit READ ONLY transaction and never issues a mutation statement', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql.trim());
        if (sql.includes('current_database')) return { rows: [{
          database_name: 'discovery_test', observed_at: '2026-08-26T05:09:00.000Z', tallinn_date: '2026-08-26',
        }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    await captureQueueSnapshot({ connect: async () => client }, 'before');
    expect(queries[0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(queries.at(-1)).toBe('ROLLBACK');
    expect(queries.slice(1, -1).every((sql) => /^(SELECT|WITH)\b/i.test(sql))).toBe(true);
    expect(queries.join('\n')).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
  });

  it('keeps the workflow observations non-blocking and uploads 30-day JSON/NDJSON artifacts', () => {
    const workflow = readFileSync('.github/workflows/collect-daily.yml', 'utf8');
    expect(workflow).toContain('CompanyFacts queue snapshot (before)');
    expect(workflow).toContain('CompanyFacts queue snapshot and paired report (after)');
    expect(workflow).toContain('observation.ndjson');
    expect(workflow).toContain('retention-days: 30');
    expect(workflow.match(/continue-on-error: true/g)).toHaveLength(3);
    expect(workflow.match(/^\s+timeout-minutes: 1\s*$/gm)).toHaveLength(2);
    expect(workflow).toContain('if: always()');
  });
});
