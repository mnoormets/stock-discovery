import { beforeEach, describe, expect, it } from 'vitest';
import { pool, resolveCollectionCompanyIds, saveCollectedCompanies } from '../../src/lib/db';
import { buildCandidates } from '../../src/lib/discovery';
import { recordCollectionRunItem } from '../../src/lib/collection-run-items';
import { startCollectionRun } from '../../src/lib/collection-runs';
import type { ApeWisdomRow, Candidate, Fundamentals } from '../../src/lib/types';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    ticker: 'RDDT', name: 'Reddit', mentions: 13, mentionsPrev: 20,
    mentionGrowth: -0.35, upvotes: 50, rank: 56, rankPrev: 40,
    sentiment: 'Neutral', sentimentSource: 'apewisdom', sentimentValue: 0,
    marketCap: null, price: null, currency: null, volume: null,
    fundamentalsSource: null, discoveryScore: 20, isNew: false, risingDays: 0,
    secSuspended: false, warnings: [],
    parts: { growth: 0, sustain: 0, sentiment: 0, cap: 0, novelty: 0, penalties: 0 },
    ...overrides,
  };
}

function radar(ticker: string, name = `${ticker} Inc.`): ApeWisdomRow {
  return { ticker, name, rank: 1, mentions: 20, upvotes: 10, rank_24h_ago: 2, mentions_24h_ago: 10 };
}

function providerFundamentals(ticker: string, overrides: Partial<Fundamentals> = {}): Fundamentals {
  return { ticker, name: `${ticker} Inc.`, price: 10, marketCap: 1_000_000_000, source: 'yahoo', ...overrides };
}

describe('radar ticker persistence', () => {
  it('säilitab turuandmeteta tickeri companies tabelis, kuid ei leiuta hinnasnapshoti', async () => {
    await saveCollectedCompanies([candidate()]);
    const { rows } = await pool.query(`
      SELECT c.ticker, c.source, count(p.id)::int AS prices
      FROM companies c LEFT JOIN price_snapshots p ON p.company_id = c.id
      WHERE c.ticker = 'RDDT' GROUP BY c.id
    `);
    expect(rows).toEqual([{ ticker: 'RDDT', source: 'collection', prices: 0 }]);
  });

  it('on kordusjooksul idempotentne ning lisab päris turuandmete saabumisel hinna', async () => {
    await saveCollectedCompanies([candidate()]);
    await saveCollectedCompanies([candidate({ price: 150, currency: 'USD', fundamentalsSource: 'yahoo' })]);
    const { rows } = await pool.query(`
      SELECT count(DISTINCT c.id)::int AS companies, count(p.id)::int AS prices, max(p.currency) AS currency
      FROM companies c LEFT JOIN price_snapshots p ON p.company_id = c.id WHERE c.ticker = 'RDDT'
    `);
    expect(rows[0]).toEqual({ companies: 1, prices: 1, currency: 'USD' });
  });

  it('links usable provider identity even when discovery filtering removes the ticker', async () => {
    const row = radar('LARGE');
    const fund = providerFundamentals('LARGE', { marketCap: 100_000_000_000 });
    const candidates = buildCandidates([row], new Map(), new Map([['LARGE', fund]]), new Map(), new Set());
    expect(candidates).toEqual([]);

    const candidateIds = await saveCollectedCompanies(candidates);
    expect(candidateIds.size).toBe(0);
    const identities = await resolveCollectionCompanyIds(['LARGE'], new Map([['LARGE', fund]]));
    const companyId = identities.get('LARGE');
    expect(companyId).toBeTypeOf('number');

    const collectionRunId = (await startCollectionRun('company-link-test')).id;
    const item = await recordCollectionRunItem({
      collectionRunId, ticker: 'LARGE', lookupBucket: 'growth', selectedForMarketData: true,
      marketDataAttempted: true, marketDataFound: true, marketDataSource: 'yahoo', companyId,
    });
    expect(item.companyId).toBe(companyId);
    expect((await pool.query('SELECT count(*)::int AS count FROM price_snapshots')).rows[0].count).toBe(0);
  });

  it('links an existing observed company without current fundamentals', async () => {
    const companyId = await insertCompany('KNOWN');
    const identities = await resolveCollectionCompanyIds(['known'], new Map());
    expect(identities.get('KNOWN')).toBe(companyId);
  });

  it('leaves an unknown observed ticker unresolved and does not fabricate a company', async () => {
    const identities = await resolveCollectionCompanyIds(['UNKNOWN'], new Map());
    expect(identities.has('UNKNOWN')).toBe(false);
    expect((await pool.query("SELECT count(*)::int AS count FROM companies WHERE ticker = 'UNKNOWN'"))
      .rows[0].count).toBe(0);
  });

  it('ignores empty provider payloads and fundamentals outside the observed universe', async () => {
    const identities = await resolveCollectionCompanyIds(
      ['EMPTY'],
      new Map([
        ['EMPTY', providerFundamentals('EMPTY', { price: undefined, marketCap: undefined, volume: undefined })],
        ['OTHER', providerFundamentals('OTHER')],
      ]),
    );
    expect(identities.size).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM companies')).rows[0].count).toBe(0);
  });

  it('does not mutate historical collection item links while resolving later identities', async () => {
    const collectionRunId = (await startCollectionRun('company-link-history-test')).id;
    const historical = await recordCollectionRunItem({
      collectionRunId, ticker: 'LATER', lookupBucket: 'growth', selectedForMarketData: true,
      marketDataAttempted: true, marketDataFound: true, marketDataSource: 'yahoo', companyId: null,
    });
    const identities = await resolveCollectionCompanyIds(
      ['LATER'],
      new Map([['LATER', providerFundamentals('LATER')]]),
    );
    expect(identities.get('LATER')).toBeTypeOf('number');
    const stored = await pool.query('SELECT company_id FROM collection_run_items WHERE id = $1', [historical.id]);
    expect(stored.rows[0].company_id).toBeNull();
  });
});

