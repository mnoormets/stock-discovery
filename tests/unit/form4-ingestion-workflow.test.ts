import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scheduled Form 4 ingestion workflow integration', () => {
  const workflow = readFileSync('.github/workflows/collect-daily.yml', 'utf8');

  it('runs a bounded rolling ingestion before collect and skips writes on dry-run', () => {
    const ingestion = workflow.indexOf('name: Ingest recent SEC Form 4 filings');
    const collect = workflow.indexOf('name: collect:daily');
    expect(ingestion).toBeGreaterThan(0);
    expect(collect).toBeGreaterThan(ingestion);
    expect(workflow).toContain("if: ${{ inputs.dry_run != true }}");
    expect(workflow).toContain('npm run ingest:form4 -- --recent-days 7 --fail-on-filing-error');
  });

  it('bounds ingestion but allows core collection before surfacing a workflow failure', () => {
    expect(workflow).toMatch(/name: Ingest recent SEC Form 4 filings[\s\S]*?continue-on-error: true[\s\S]*?timeout-minutes: 15/);
    const collect = workflow.indexOf('name: collect:daily');
    const failureGate = workflow.indexOf('name: Fail workflow when Form 4 ingestion failed');
    expect(failureGate).toBeGreaterThan(collect);
    expect(workflow).toContain("steps.form4_ingest.outcome == 'failure'");
    expect(workflow).toContain('timeout-minutes: 25');
  });
});
