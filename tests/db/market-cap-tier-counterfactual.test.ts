import { beforeEach, describe, expect, it } from 'vitest';

import { captureCalibration } from '../../scripts/calibrate-market-cap-tiers.cjs';
import { pool } from '../../src/lib/db';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

describe('market-cap tier counterfactual database boundary', () => {
  it('reads the canonical history without changing participating table counts', async () => {
    const before = (await pool.query(`SELECT
      (SELECT count(*)::int FROM discovery_runs) AS runs,
      (SELECT count(*)::int FROM discovery_decisions) AS decisions,
      (SELECT count(*)::int FROM candidate_outcomes) AS outcomes`)).rows[0];

    const report = await captureCalibration(pool);

    expect(report).toMatchObject({
      schemaVersion: 'market-cap-tier-counterfactual-v1',
      coverage: {
        canonicalRuns: 0,
        currentSelectionObservations: 0,
        counterfactualSelectionObservations: 0,
      },
    });
    const after = (await pool.query(`SELECT
      (SELECT count(*)::int FROM discovery_runs) AS runs,
      (SELECT count(*)::int FROM discovery_decisions) AS decisions,
      (SELECT count(*)::int FROM candidate_outcomes) AS outcomes`)).rows[0];
    expect(after).toEqual(before);
  });
});
