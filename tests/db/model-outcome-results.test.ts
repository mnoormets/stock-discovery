import { beforeEach, describe, expect, it } from 'vitest';
import { getBacktestDashboard } from '../../src/lib/backtest';
import { getValidationDashboard, recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { pool } from '../../src/lib/db';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(async () => {
  await resetDb();
});

async function setOneWeekOutcome(
  runId: number,
  ticker: string,
  status: 'measured' | 'missing' | 'unavailable',
  returnPercent: number | null,
  excessReturnPercent: number | null,
): Promise<void> {
  await pool.query(
    `UPDATE candidate_outcomes o
     SET status = $3,
         return_percent = $4,
         measured_at = CASE WHEN $3 = 'measured' THEN now() ELSE NULL END,
         benchmark_status = CASE WHEN $5::numeric IS NULL THEN 'pending' ELSE 'measured' END,
         excess_return_percent = $5
     FROM discovery_decisions d
     WHERE o.decision_id = d.id
       AND d.run_id = $1
       AND d.ticker = $2
       AND o.horizon = '1w'`,
    [runId, ticker, status, returnPercent, excessReturnPercent],
  );
}

describe('model-version and horizon result cohorts', () => {
  it('separates model versions, exposes coverage, and weights repeated tickers once', async () => {
    const aaaId = await insertCompany('AAA');
    const bbbId = await insertCompany('BBB');
    const v2Runs: number[] = [];

    for (const day of [1, 2, 3]) {
      const run = await recordDiscoveryRun(
        ['test-rule'],
        [makeDecisionInput({ companyId: aaaId, ticker: 'AAA' })],
        new Date(`2030-01-0${day}T12:00:00.000Z`),
        'rklb_daily',
      );
      v2Runs.push(run.runId);
      await pool.query(
        `UPDATE discovery_runs SET model_version = 'rklb-discovery-v2' WHERE id = $1`,
        [run.runId],
      );
    }

    const v3Run = await recordDiscoveryRun(
      ['test-rule'],
      [
        makeDecisionInput({ companyId: aaaId, ticker: 'AAA', candidateRank: 1 }),
        makeDecisionInput({ companyId: bbbId, ticker: 'BBB', candidateRank: 2 }),
      ],
      new Date('2030-01-04T12:00:00.000Z'),
      'rklb_daily',
    );

    await setOneWeekOutcome(v2Runs[0], 'AAA', 'measured', 10, 5);
    await setOneWeekOutcome(v2Runs[1], 'AAA', 'measured', -10, -15);
    await setOneWeekOutcome(v2Runs[2], 'AAA', 'missing', null, null);
    await setOneWeekOutcome(v3Run.runId, 'AAA', 'measured', 20, 10);
    await setOneWeekOutcome(v3Run.runId, 'BBB', 'unavailable', null, null);

    const validation = await getValidationDashboard();
    const backtest = await getBacktestDashboard();

    expect(validation.models.map((model) => model.modelVersion)).toEqual([
      'rklb-discovery-v3',
      'rklb-discovery-v2',
    ]);
    const validationV2 = validation.models[1];
    expect(validationV2).toMatchObject({ runCount: 3, decisionCount: 3, distinctTickerCount: 1 });
    expect(validationV2.horizons.find((item) => item.horizon === '1w')).toMatchObject({
      decisionCount: 3,
      distinctTickerCount: 1,
      measuredDecisionCount: 2,
      measuredTickerCount: 1,
      pendingCount: 0,
      missingCount: 1,
      unavailableCount: 0,
      averageReturn: 0,
      medianReturn: 0,
      winnerCount: 0,
      loserCount: 0,
      flatCount: 1,
    });

    const backtestV2 = backtest.models.find((model) => model.modelVersion === 'rklb-discovery-v2')!;
    expect(backtestV2.horizons.find((item) => item.horizon === '1w')).toMatchObject({
      measuredDecisionCount: 2,
      measuredTickerCount: 1,
      missingCount: 1,
      averageReturn: 0,
      hitRatePercent: 0,
      benchmarkMeasuredDecisionCount: 2,
      benchmarkMeasuredTickerCount: 1,
      averageExcessReturn: -5,
      beatBenchmarkPercent: 0,
    });

    const validationV3 = validation.models[0].horizons.find((item) => item.horizon === '1w')!;
    expect(validationV3).toMatchObject({
      decisionCount: 2,
      distinctTickerCount: 2,
      measuredDecisionCount: 1,
      measuredTickerCount: 1,
      unavailableCount: 1,
      averageReturn: 20,
    });
  });
});
