import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/paper-strategy-execute.yml', 'utf8');

describe('paper strategy execution workflow safety', () => {
  it('is manually dispatchable, bounded, serialized, and calls only the paper runner', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^\s+schedule:/m);
    expect(workflow).toContain('group: paper-strategy-execute');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('timeout-minutes: 5');
    expect(workflow).toContain('npm run paper:strategy -- execute');
    expect(workflow).not.toContain('collect:daily');
  });

  it('uses the existing Neon secret without embedding a connection string', () => {
    expect(workflow).toContain('DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}');
    expect(workflow).not.toContain('postgresql://');
    expect(workflow).not.toContain('postgres://');
  });
});
