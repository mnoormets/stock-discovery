import { describe, expect, it } from 'vitest';

const { parseArgs } = await import('../../scripts/ingest-form4.cjs');

describe('Form 4 ingestion CLI boundary', () => {
  it('requires an explicit bounded date range', () => {
    expect(parseArgs(['--from', '2026-08-19', '--to', '2026-08-21']))
      .toEqual({ from: '2026-08-19', to: '2026-08-21' });
    expect(() => parseArgs([])).toThrow('--from ja --to');
    expect(() => parseArgs(['--from', '2026-08-21', '--to', '2026-08-19'])).toThrow('vigane');
    expect(() => parseArgs(['--from', '2026-02-31', '--to', '2026-03-01'])).toThrow('vigane');
    expect(() => parseArgs(['--from', '2026-01-01', '--to', '2026-02-01'])).toThrow('31');
  });

  it('rejects unknown flags instead of silently expanding scope', () => {
    expect(() => parseArgs(['--from', '2026-08-19', '--to', '2026-08-21', '--all']))
      .toThrow('Tundmatu argument');
  });
});
