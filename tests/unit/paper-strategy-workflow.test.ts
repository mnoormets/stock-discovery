import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/paper-strategy-execute.yml', 'utf8');

describe('paper strategy execution workflow safety', () => {
  it('runs independent session research after paper execution even when the control fails', () => {
    expect(workflow.indexOf('node scripts/track-session-prices.cjs')).toBeGreaterThan(workflow.indexOf('npm run paper:strategy -- execute'));
    expect(workflow).toContain('if: ${{ !cancelled() }}');
    expect(workflow).toContain('timeout-minutes: 2');
    const cli=readFileSync('scripts/track-session-prices.cjs','utf8');
    expect(cli).toContain('isExpectedNewYorkRegularSession(now)');
    expect(cli).toContain('collectTrackedPrices()');
    expect(cli).not.toContain('executeCapitalPaper');
    expect(cli).not.toContain('executePendingPaperOrders');
  });
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
    expect(workflow).toContain('DATABASE_TARGET: golden');
    expect(workflow).not.toContain('postgresql://');
    expect(workflow).not.toContain('postgres://');
  });

  it('pings a separate optional dead-man switch only after execution', () => {
    const execution = workflow.indexOf('npm run paper:strategy -- execute');
    const heartbeat = workflow.indexOf('Send paper execution Healthchecks heartbeat');

    expect(execution).toBeGreaterThan(-1);
    expect(heartbeat).toBeGreaterThan(execution);
    expect(workflow).toContain(
      'PAPER_STRATEGY_HEALTHCHECKS_PING_URL: ${{ secrets.PAPER_STRATEGY_HEALTHCHECKS_PING_URL }}',
    );
    expect(workflow).toContain('curl --fail --silent --show-error --max-time 10');
    expect(workflow).toContain('continue-on-error: true');
  });
});
