import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  getThesisWorkspace,
  saveThesisCard,
  type ThesisCardInput,
} from '../../src/lib/thesis';
import { insertCompany } from '../fixtures/company';
import { resetDb } from '../setup/reset';

beforeEach(async () => {
  await resetDb();
});

async function insertPosition(companyId: number, ticker: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO portfolio_positions (company_id, ticker, quantity, average_buy_price, status)
     VALUES ($1, $2, 0, 0, 'watch') RETURNING id`,
    [companyId, ticker],
  );
  return Number(rows[0].id);
}

async function insertPrice(companyId: number, price: number, capturedAt: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO price_snapshots
       (company_id, price, market_cap, currency, source, captured_at, market_at)
     VALUES ($1, $2, 1250000000, 'USD', 'test', $3, $3) RETURNING id`,
    [companyId, price, capturedAt],
  );
  return Number(rows[0].id);
}

function thesisInput(priceSnapshotId: number | null): ThesisCardInput {
  return {
    summary: 'Revenue growth must turn into durable owner earnings.',
    business: 'Sells mission-critical software.',
    whyNow: 'Backlog conversion becomes observable this year.',
    moat: 'Embedded workflows and switching costs.',
    mispricing: 'The market may be discounting the backlog.',
    catalyst: 'The next annual filing updates conversion and retention.',
    invalidation: 'Revenue growth falls below 10% while cash burn rises.',
    twelveMonthCheckpoint: 'Revenue grows at least 20% and FCF improves.',
    checkpointIsMeasurable: true,
    revenueAssumption: '20% annual growth through 2028.',
    marginAssumption: 'Operating margin reaches 15% by 2028.',
    cashFlowAssumption: 'Positive FCF during 2027.',
    dilutionAssumption: 'Share count growth stays below 3% annually.',
    valuationAssumption: 'A 5x sales multiple requires durable 20% growth.',
    downsideScenario: '10% growth and continued burn imply a materially lower multiple.',
    reverseValuationQuestion: 'Can revenue reach $500m with 15% operating margins by 2028?',
    nextReviewTrigger: 'Review after the next annual filing.',
    timeHorizon: '3 years',
    status: 'researching',
    scoreSnapshotId: null,
    valuationPriceSnapshotId: priceSnapshotId,
  };
}

describe('Thesis valuation decision review', () => {
  it('versions company assumptions with their exact price context and remains idempotent', async () => {
    const companyId = await insertCompany('VALUE', { name: 'Value Review Inc.' });
    const positionId = await insertPosition(companyId, 'VALUE');
    const firstPriceId = await insertPrice(companyId, 25.5, '2026-09-04T20:00:00.000Z');

    expect(await saveThesisCard(positionId, thesisInput(firstPriceId))).toEqual({ created: true, version: 1 });
    expect(await saveThesisCard(positionId, thesisInput(firstPriceId))).toEqual({ created: false, version: 1 });

    const secondPriceId = await insertPrice(companyId, 27, '2026-09-08T20:00:00.000Z');
    const second = thesisInput(secondPriceId);
    second.marginAssumption = 'Operating margin reaches 18% by 2028.';
    expect(await saveThesisCard(positionId, second)).toEqual({ created: true, version: 2 });

    const workspace = await getThesisWorkspace(positionId);
    expect(workspace?.latestValuationPrice).toMatchObject({ id: secondPriceId, price: 27, currency: 'USD' });
    expect(workspace?.current).toMatchObject({
      version: 2,
      marginAssumption: 'Operating margin reaches 18% by 2028.',
      valuationPriceSnapshotId: secondPriceId,
      valuationPrice: { id: secondPriceId, price: 27, marketCap: 1250000000 },
    });
    expect(workspace?.history[1]).toMatchObject({
      version: 1,
      marginAssumption: 'Operating margin reaches 15% by 2028.',
      valuationPriceSnapshotId: firstPriceId,
      valuationPrice: { id: firstPriceId, price: 25.5 },
    });
    await expect(pool.query('DELETE FROM price_snapshots WHERE id = $1', [firstPriceId])).rejects.toThrow();
  });

  it('drops a price snapshot that belongs to another company', async () => {
    const companyId = await insertCompany('OWN');
    const otherCompanyId = await insertCompany('OTHER');
    const positionId = await insertPosition(companyId, 'OWN');
    const foreignPriceId = await insertPrice(otherCompanyId, 99, '2026-09-08T20:00:00.000Z');

    expect(await saveThesisCard(positionId, thesisInput(foreignPriceId))).toEqual({ created: true, version: 1 });
    const workspace = await getThesisWorkspace(positionId);
    expect(workspace?.current?.valuationPriceSnapshotId).toBeNull();
    expect(workspace?.current?.valuationPrice).toBeNull();
  });
});
