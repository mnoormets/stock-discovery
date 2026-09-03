import { describe, expect, it } from 'vitest';

const {
  CONNECTION_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  assertNoFilingFailures,
  ingestionPoolConfig,
  parseArgs,
  recentCompletedUsDateRange,
} = await import('../../scripts/ingest-form4.cjs');

describe('Form 4 ingestion CLI boundary', () => {
  it('requires an explicit bounded date range', () => {
    expect(parseArgs(['--from', '2026-08-19', '--to', '2026-08-21']))
      .toEqual({ from: '2026-08-19', to: '2026-08-21', failOnFilingError: false });
    expect(() => parseArgs([])).toThrow('--from ja --to');
    expect(() => parseArgs(['--from', '2026-08-21', '--to', '2026-08-19'])).toThrow('vigane');
    expect(() => parseArgs(['--from', '2026-02-31', '--to', '2026-03-01'])).toThrow('vigane');
    expect(() => parseArgs(['--from', '2026-01-01', '--to', '2026-02-01'])).toThrow('31');
  });

  it('rejects unknown flags instead of silently expanding scope', () => {
    expect(() => parseArgs(['--from', '2026-08-19', '--to', '2026-08-21', '--all']))
      .toThrow('Tundmatu argument');
  });

  it('derives a bounded rolling range ending on the previous New York date', () => {
    const now = new Date('2026-09-03T05:10:00.000Z');
    expect(recentCompletedUsDateRange(7, now)).toEqual({ from: '2026-08-27', to: '2026-09-02' });
    expect(parseArgs(['--recent-days', '7', '--fail-on-filing-error'], now)).toEqual({
      from: '2026-08-27',
      to: '2026-09-02',
      failOnFilingError: true,
    });
    expect(() => parseArgs(['--recent-days', '0'], now)).toThrow('1...31');
    expect(() => parseArgs(['--recent-days', '7', '--from', '2026-08-20'], now)).toThrow('ei tohi olla koos');
  });

  it('bounds automated database connection and statement execution time', () => {
    expect(CONNECTION_TIMEOUT_MS).toBe(10_000);
    expect(STATEMENT_TIMEOUT_MS).toBe(30_000);
    expect(ingestionPoolConfig('postgres://example')).toEqual({
      connectionString: 'postgres://example',
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    });
  });

  it('fails scheduled ingestion when any filing could not be fetched, parsed or persisted', () => {
    const clean = { fetchFailed: 0, parseFailed: 0, persistFailed: 0 };
    expect(() => assertNoFilingFailures(clean, true)).not.toThrow();
    expect(() => assertNoFilingFailures({ ...clean, parseFailed: 1 }, false)).not.toThrow();
    expect(() => assertNoFilingFailures({ ...clean, fetchFailed: 1, persistFailed: 2 }, true))
      .toThrow('3 filing-veaga');
  });
});
