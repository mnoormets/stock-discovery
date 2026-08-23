import { beforeEach, describe, expect, inject, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  COLLECTION_RUN_ITEM_VERSION,
  getCollectionRunItems,
  recordCollectionRunItem,
  recordCollectionRunItems,
  resolveLookupBucket,
  type CollectionRunItemInput,
} from '../../src/lib/collection-run-items';
import { startCollectionRun, succeedCollectionRun } from '../../src/lib/collection-runs';
import { recordDiscoveryRun } from '../../src/lib/discovery-validation';
import { insertCompany } from '../fixtures/company';
import { makeDecisionInput } from '../fixtures/decision';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

async function startedRun(): Promise<number> {
  return (await startCollectionRun('provenance-test')).id;
}

function item(collectionRunId: number, ticker: string, overrides: Partial<CollectionRunItemInput> = {}): CollectionRunItemInput {
  return {
    collectionRunId,
    ticker,
    lookupBucket: 'growth',
    selectedForMarketData: true,
    marketDataAttempted: true,
    marketDataFound: true,
    marketDataSource: 'yahoo',
    mentionCount: 12,
    previousMentionCount: 6,
    mentionGrowthPercent: 100,
    attentionRank: 3,
    growthRank: 1,
    rawSignal: { source: 'apewisdom' },
    warnings: [],
    ...overrides,
  };
}

describe('collection -> canonical ticker provenance bridge', () => {
  it('A1 salvestab growth bucketi market-data valikuna', async () => {
    const runId = await startedRun();
    const saved = await recordCollectionRunItem(item(runId, 'rddt'));
    expect(saved).toMatchObject({
      collectionRunId: runId,
      ticker: 'RDDT',
      itemVersion: COLLECTION_RUN_ITEM_VERSION,
      lookupBucket: 'growth',
      selectedForMarketData: true,
    });
  });

  it('A2 salvestab recall bucketi eraldi', async () => {
    const runId = await startedRun();
    const saved = await recordCollectionRunItem(item(runId, 'RDDT', {
      lookupBucket: 'recall',
      growthRank: null,
      recallRank: 2,
    }));
    expect(saved).toMatchObject({ lookupBucket: 'recall', selectedForMarketData: true, recallRank: 2 });
  });

  it('A3 salvestab radaril olnud, kuid lookupist välja jäänud tickeri', async () => {
    const runId = await startedRun();
    const saved = await recordCollectionRunItem(item(runId, 'LATE', {
      lookupBucket: 'not_selected',
      selectedForMarketData: false,
      marketDataAttempted: false,
      marketDataFound: false,
      marketDataSource: null,
      growthRank: null,
    }));
    expect(saved).toMatchObject({
      lookupBucket: 'not_selected', marketDataAttempted: false, marketDataFound: false,
    });
  });

  it('A4 säilitab lookup-katse, millel market data puudus', async () => {
    const runId = await startedRun();
    const saved = await recordCollectionRunItem(item(runId, 'MISS', {
      marketDataFound: false,
      marketDataSource: 'none',
      skipReason: 'no_market_data',
    }));
    expect(saved).toMatchObject({
      marketDataAttempted: true,
      marketDataFound: false,
      marketDataSource: 'none',
      skipReason: 'no_market_data',
    });
  });

  it('A5 seob leitud market data salvestatud companyga', async () => {
    const runId = await startedRun();
    const companyId = await insertCompany('FOUND');
    const saved = await recordCollectionRunItem(item(runId, 'FOUND', { companyId }));
    expect(saved.marketDataFound).toBe(true);
    expect(saved.companyId).toBe(companyId);
  });

  it('A6 identne kordus on immutable ja idempotentne', async () => {
    const runId = await startedRun();
    const input = item(runId, 'SAME');
    const first = await recordCollectionRunItem(input);
    const second = await recordCollectionRunItem(input);
    expect(second).toEqual(first);
    expect(await getCollectionRunItems(runId)).toHaveLength(1);
    await expect(recordCollectionRunItem({ ...input, lookupBucket: 'recall', growthRank: null, recallRank: 1 }))
      .rejects.toThrow('teistsuguse terminalinfoga');
  });

  it('A7 growth võidab deterministlikult growth+recall konflikti', () => {
    expect(resolveLookupBucket('ALL', new Set(['ALL']), new Set(['ALL']), new Set(['ALL']))).toBe('growth');
    expect(resolveLookupBucket('RECALL', new Set(), new Set(['RECALL']), new Set(['RECALL']))).toBe('recall');
    expect(resolveLookupBucket('INSIDER', new Set(), new Set(), new Set(['INSIDER']))).toBe('insider');
  });

  it('A7b salvestab insider bucketi ja ranki idempotentselt', async () => {
    const runId = await startedRun();
    const input = item(runId, 'FORM', {
      lookupBucket: 'insider', mentionCount: null, previousMentionCount: null,
      mentionGrowthPercent: null, attentionRank: null, growthRank: null,
      recallRank: null, insiderRank: 4,
      rawSignal: { source: 'sec-form4', policyVersion: 'form4-insider-selection-v1' },
    });
    const first = await recordCollectionRunItem(input);
    const second = await recordCollectionRunItem(input);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ lookupBucket: 'insider', insiderRank: 4, mentionCount: null });
  });

  it('A8 canonical discovery run viitab sama collection runile', async () => {
    const collectionRunId = await startedRun();
    await recordCollectionRunItems([item(collectionRunId, 'LINK')]);
    await succeedCollectionRun(collectionRunId, { itemCount: 1 });
    const companyId = await insertCompany('LINK');
    const discovery = await recordDiscoveryRun(
      ['provenance rule'],
      [makeDecisionInput({ companyId, ticker: 'LINK' })],
      new Date('2026-08-15T08:00:00.000Z'),
      'rklb_daily',
      collectionRunId,
    );
    const { rows } = await pool.query('SELECT collection_run_id FROM discovery_runs WHERE id = $1', [discovery.runId]);
    const decision = await pool.query(
      `SELECT d.company_id, d.collection_run_item_id, i.company_id AS item_company_id
       FROM discovery_decisions d
       JOIN collection_run_items i ON i.id = d.collection_run_item_id
       WHERE d.run_id = $1 AND d.ticker = 'LINK'`,
      [discovery.runId],
    );
    expect(discovery.collectionRunId).toBe(collectionRunId);
    expect(Number(rows[0].collection_run_id)).toBe(collectionRunId);
    expect(Number(decision.rows[0].company_id)).toBe(companyId);
    expect(Number(decision.rows[0].collection_run_item_id)).toBeGreaterThan(0);
    expect(decision.rows[0].item_company_id).toBeNull();
  });

  it('A9 manual run töötab ilma collection_run_id-ta', async () => {
    const companyId = await insertCompany('MANU');
    const discovery = await recordDiscoveryRun(
      ['manual rule'],
      [makeDecisionInput({ companyId, ticker: 'MANU' })],
      new Date('2026-08-15T08:00:00.000Z'),
      'rklb',
    );
    expect(discovery.created).toBe(true);
    expect(discovery.collectionRunId).toBeNull();
  });

  it('A10 test DB sisaldab 0004 tabelit ja canonical link-veergu', async () => {
    expect(inject('appliedMigrations')).toContain('0004_collection_run_items');
    expect(inject('migratedTables')).toContain('collection_run_items');
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'discovery_runs'
          AND column_name = 'collection_run_id'
      ) AS ok`);
    expect(rows[0].ok).toBe(true);
  });

  // Batch-guard oli varem täiesti katmata: ükski test ei andnud
  // `recordCollectionRunItems`-ile mitme-elemendilist massiivi. Just see guard
  // tuvastas collection run’ide #4, #5 ja #6 duplikaadid. Juurpõhjus on nüüd
  // `fetchApeWisdom`-is parandatud, kuid guard jääb teadlikult alles: see on
  // teine kaitsekiht sama piirangu ees, mida jõustab ka DB
  // (collection_run_items_run_ticker_key UNIQUE collection_run_id + ticker).
  it('A11 kehtiv mitme-kirjeline batch salvestub tervikuna', async () => {
    const runId = await startedRun();
    const saved = await recordCollectionRunItems([
      item(runId, 'AAA'),
      item(runId, 'BBB'),
      item(runId, 'CCC'),
    ]);
    expect(saved).toHaveLength(3);
    expect((await getCollectionRunItems(runId)).map((row) => row.ticker).sort())
      .toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('A12 duplikaatne batch lükatakse tagasi ega salvesta ühtki rida', async () => {
    const runId = await startedRun();
    await expect(recordCollectionRunItems([
      item(runId, 'AAA'),
      item(runId, 'OPEN'),
      item(runId, 'OPEN', { lookupBucket: 'recall', growthRank: null, recallRank: 2 }),
    ])).rejects.toThrow(`Collection run item batch sisaldab duplikaati: ${runId}:OPEN.`);
    // Guard jookseb ENNE transaktsiooni, seega ka esimene kehtiv kirje ei salvestu.
    expect(await getCollectionRunItems(runId)).toHaveLength(0);
  });

  it('A13 guard võtmestab normaliseeritud tickeri järgi', async () => {
    const runId = await startedRun();
    await expect(recordCollectionRunItems([
      item(runId, 'open'),
      item(runId, ' OPEN '),
    ])).rejects.toThrow(`Collection run item batch sisaldab duplikaati: ${runId}:OPEN.`);
  });
});
