import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { captureQueueSnapshot } from '../../scripts/report-companyfacts-queue.cjs';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

describe('CompanyFacts queue observation database boundary', () => {
  it('captures the real eligible queue without changing participating table counts', async () => {
    const companyId = await insertCompany('QUEUEOBS');
    await pool.query(`INSERT INTO price_snapshots (company_id, price, source, captured_at)
      VALUES ($1, 12.34, 'test', now())`, [companyId]);
    const before = (await pool.query(`SELECT
      (SELECT count(*)::int FROM companies) AS companies,
      (SELECT count(*)::int FROM price_snapshots) AS prices,
      (SELECT count(*)::int FROM financial_facts) AS facts,
      (SELECT count(*)::int FROM financial_enrichment_status) AS statuses`)).rows[0];

    const observed = await captureQueueSnapshot(pool, 'before');

    expect(observed).toMatchObject({
      schemaVersion: 'companyfacts-queue-observation-v1',
      phase: 'before',
      databaseName: 'discovery_test',
      queue: { eligibleDepth: 1, missingFacts: 1, staleFacts: 0, neverAttempted: 1 },
    });
    expect(observed.queue.orderedEligible[0]).toMatchObject({
      companyId, ticker: 'QUEUEOBS', eligibilityReason: 'missing_facts',
      enrichment: { attemptCount: null, attemptCountAvailability: 'not_stored' },
    });
    expect(observed.queue.oldestNeverAttempted.timestampMeaning)
      .toBe('companies.created_at proxy for first eligibility');

    const after = (await pool.query(`SELECT
      (SELECT count(*)::int FROM companies) AS companies,
      (SELECT count(*)::int FROM price_snapshots) AS prices,
      (SELECT count(*)::int FROM financial_facts) AS facts,
      (SELECT count(*)::int FROM financial_enrichment_status) AS statuses`)).rows[0];
    expect(after).toEqual(before);
  });
});
