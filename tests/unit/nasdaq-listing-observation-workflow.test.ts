import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Nasdaq listing observation workflow', () => {
  const workflow = readFileSync('.github/workflows/nasdaq-listing-observation.yml', 'utf8');

  it('is externally dispatched and cannot write to Neon or run production collection', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(workflow).not.toContain('DATABASE_URL');
    expect(workflow).not.toContain('NEON_DATABASE_URL');
    expect(workflow).not.toContain('collect:daily');
    expect(workflow).not.toContain('migrate');
  });

  it('bounds the observer and retains raw plus versioned report artifacts for 30 days', () => {
    expect(workflow).toContain('timeout-minutes: 3');
    expect(workflow).toContain('timeout-minutes: 1');
    expect(workflow).toContain('calibrate:nasdaq-listings -- --artifact-dir artifacts/nasdaq-listings');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('retention-days: 30');
  });
});
