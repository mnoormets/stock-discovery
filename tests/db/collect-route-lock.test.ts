import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCollectRequest,
  type CollectRouteDependencies,
} from '../../src/lib/collect-route-handler';
import { COLLECTION_ADVISORY_LOCK_NAME } from '../../src/lib/collection-lock';
import { pool } from '../../src/lib/db';
import { resetDb } from '../setup/reset';

const previousSecret = process.env.CRON_SECRET;

beforeEach(async () => {
  await resetDb();
  process.env.CRON_SECRET = 'collect-lock-test-secret';
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousSecret == null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

function request(): Request {
  return new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: { authorization: 'Bearer collect-lock-test-secret' },
  });
}

function dependencies(): CollectRouteDependencies {
  return {
    // Kogu `runCollection` tagastuskuju, mitte cast: nii jääb test seotuks
    // päris tüübiga ja katkeb valjult, kui kuju muutub.
    runCollection: vi.fn(async () => ({
      collectionRunId: 1,
      captureDate: '2026-08-17',
      scanned: 0,
      candidates: 0,
      marketDataLookup: { growth: 0, recall: 0, total: 0 },
      secSuspensionsTracked: 0,
      flagged: 0,
      liveDataSaved: true,
      providers: {
        apewisdomRows: 0,
        apewisdomUniqueRows: 0,
        tradestieRows: 0,
        tradestieFallback: false,
        secSuspensionsFetched: 0,
        secFallback: false,
        yahooFundamentals: 0,
        fmpRequested: 0,
        fmpFundamentals: 0,
      },
      top: [],
    })),
    collectDefaultBenchmarkPrice: vi.fn(async () => true),
    enrichStoredCompanyFinancials: vi.fn(async () => ({
      status: 'completed', financialUniverse: 0, coveredBefore: 0, coveredAfter: 0,
      attempted: 0, enriched: 0, unavailable: 0, failed: 0, dailyLimit: 5,
      attemptedTodayBefore: 0, dailyRemaining: 5, attemptedTickers: [],
      unavailableTickers: [], failedTickers: [],
    })) as CollectRouteDependencies['enrichStoredCompanyFinancials'],
    enrichCompanyClassifications: vi.fn(async () => ({
      attempted: 0, enriched: 0, unavailable: 0, failed: 0, remaining: 0,
      attemptedTickers: [], enrichedTickers: [], unavailableTickers: [], failedTickers: [],
    })),
    // Terve RklbDiscoveryResult, mitte cast — vt kommentaari runCollection juures.
    getRklbDiscoveryCandidates: vi.fn(async () => ({
      candidates: [],
      evaluatedCompanies: 0,
      recordedEvaluatedCompanies: 0,
      recordedCandidateCount: 0,
      generatedAt: '2026-08-17T00:00:00.000Z',
      rules: [],
      runId: 1,
      collectionRunId: 1,
      runReused: false,
      inputChangedAfterCanonicalSnapshot: false,
    })),
    refreshCandidateOutcomes: vi.fn(async () => 0),
  };
}

async function expectLockAvailable(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
      [COLLECTION_ADVISORY_LOCK_NAME],
    );
    expect(result.rows[0].ok).toBe(true);
    await client.query(
      'SELECT pg_advisory_unlock(hashtext($1))',
      [COLLECTION_ADVISORY_LOCK_NAME],
    );
  } finally {
    client.release();
  }
}

describe('HTTP collect advisory-lock parity', () => {
  it('uses the same shared lock name as the CLI entrypoint', () => {
    expect(COLLECTION_ADVISORY_LOCK_NAME).toBe('stock-discovery:collect-daily');
    const cli = readFileSync(resolve(process.cwd(), 'scripts/collect-daily.cjs'), 'utf8');
    expect(cli).toContain('COLLECTION_ADVISORY_LOCK_NAME: LOCK_NAME');
    expect(cli).toContain("pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]");
    expect(cli).not.toContain("const LOCK_NAME = 'stock-discovery:collect-daily'");
  });

  it('returns 409 without running collection when another session holds the lock', async () => {
    const held = await pool.connect();
    const deps = dependencies();
    try {
      await held.query(
        'SELECT pg_advisory_lock(hashtext($1))',
        [COLLECTION_ADVISORY_LOCK_NAME],
      );
      const response = await handleCollectRequest(request(), deps);
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: 'A collection run is already in progress.',
      });
      expect(deps.runCollection).not.toHaveBeenCalled();
      expect(deps.collectDefaultBenchmarkPrice).not.toHaveBeenCalled();
    } finally {
      await held.query(
        'SELECT pg_advisory_unlock(hashtext($1))',
        [COLLECTION_ADVISORY_LOCK_NAME],
      );
      held.release();
    }
  });

  it('releases the lock after a successful HTTP collection attempt', async () => {
    const response = await handleCollectRequest(request(), dependencies());
    expect(response.status).toBe(200);
    await expectLockAvailable();
  });

  it('releases the lock after a failed HTTP collection attempt', async () => {
    const deps = dependencies();
    vi.mocked(deps.runCollection).mockRejectedValueOnce(new Error('synthetic collection failure'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleCollectRequest(request(), deps);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'synthetic collection failure' });
    await expectLockAvailable();
  });
});
