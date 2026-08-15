import { beforeEach, describe, expect, it } from 'vitest';
import { pool, saveCollectedCompanies } from '../../src/lib/db';
import type { Candidate } from '../../src/lib/types';
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
});

