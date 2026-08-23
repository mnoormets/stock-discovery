import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  INSIDER_LOOKUP_LIMIT,
  INSIDER_SELECTION_POLICY_VERSION,
  selectNotableInsiderIssuers,
} from '../../src/lib/insider-discovery';
import { resetDb } from '../setup/reset';

beforeEach(resetDb);

interface SignalOptions {
  ticker: string;
  sequence: number;
  issuerName?: string;
  filedDate?: string;
  formType?: '4' | '4/A';
  notional?: number;
  director?: boolean;
  officer?: boolean;
  tenPercentOwner?: boolean;
  securityKind?: 'non_derivative' | 'derivative';
  transactionCode?: string;
  acquiredDisposedCode?: 'A' | 'D';
}

async function insertSignal(options: SignalOptions): Promise<void> {
  const filedDate = options.filedDate || '2026-08-21';
  const formType = options.formType || '4';
  const director = options.director ?? true;
  const officer = options.officer ?? false;
  const tenPercentOwner = options.tenPercentOwner ?? false;
  const accession = `0000000001-26-${String(options.sequence).padStart(6, '0')}`;
  const filing = await pool.query(
    `INSERT INTO insider_filings (
       accession_number, form_type, issuer_cik, issuer_ticker, issuer_name,
       filed_date, accepted_at, sec_submission_url, parser_version,
       ownership_xml_sha256, amendment_link_status, ingestion_status,
       ingestion_attempt_count, ingested_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'form4-xml-v1',$9,$10,'persisted',1,$7)
     RETURNING id`,
    [accession, formType, String(1000 + options.sequence), options.ticker,
      options.issuerName || `${options.ticker} Corp`, filedDate, `${filedDate}T12:00:00.000Z`,
      `https://www.sec.gov/Archives/${accession}`, 'a'.repeat(64),
      formType === '4' ? 'not_applicable' : 'unresolved'],
  );
  const filingId = Number(filing.rows[0].id);
  await pool.query(
    `INSERT INTO insider_reporting_owners (
       filing_id, owner_row_key, owner_cik, owner_name, is_director, is_officer,
       is_ten_percent_owner, is_other
     ) VALUES ($1,'owner:1',$2,$3,$4,$5,$6,false)`,
    [filingId, String(9000 + options.sequence), `Owner ${options.sequence}`,
      director, officer, tenPercentOwner],
  );
  const notional = options.notional ?? 75_000;
  await pool.query(
    `INSERT INTO insider_transactions (
       filing_id, transaction_row_key, security_kind, transaction_date,
       security_title, transaction_code, acquired_disposed_code,
       transaction_shares, transaction_price_per_share,
       reporting_owner_count, filing_has_director_owner, filing_has_officer_owner,
       filing_has_ten_percent_owner, filing_has_other_owner,
       filing_has_owner_without_declared_role
     ) VALUES ($1,'transaction:1',$2,$3,'Common Stock',$4,$5,$6,1,1,$7,$8,$9,false,false)`,
    [filingId, options.securityKind || 'non_derivative', filedDate,
      options.transactionCode || 'P', options.acquiredDisposedCode || 'A', notional,
      director, officer, tenPercentOwner],
  );
}

describe('form4-insider-selection-v1', () => {
  it('valib ainult original Form 4 director/officer non-derivative P+A ostud üle $50k', async () => {
    await insertSignal({ ticker: 'KEEP', sequence: 1, notional: 50_001, officer: true });
    await insertSignal({ ticker: 'EQUAL', sequence: 2, notional: 50_000 });
    await insertSignal({ ticker: 'TENPC', sequence: 3, notional: 1_000_000, director: false, tenPercentOwner: true });
    await insertSignal({ ticker: 'AMEND', sequence: 4, notional: 2_000_000, formType: '4/A' });
    await insertSignal({ ticker: 'DERIV', sequence: 5, notional: 2_000_000, securityKind: 'derivative' });
    await insertSignal({ ticker: 'SALE', sequence: 6, notional: 2_000_000, acquiredDisposedCode: 'D' });
    await insertSignal({
      ticker: 'PCF', sequence: 7, notional: 54_000,
      issuerName: 'HIGH INCOME SECURITIES FUND',
    });

    const selection = await selectNotableInsiderIssuers('2026-08-21');
    expect(selection).toMatchObject({
      policyVersion: INSIDER_SELECTION_POLICY_VERSION,
      sourceFiledDate: '2026-08-21', sourceAgeDays: 0, stale: false,
      eligibleIssuerCount: 1,
    });
    expect(selection.selectedIssuers.map((issuer) => issuer.ticker)).toEqual(['KEEP']);
    expect(selection.selectedIssuers[0]).toMatchObject({
      insiderRank: 1, hasDirector: true, hasOfficer: true,
      hasTenPercentOwner: false, maxDerivedNotional: 50_001,
    });
  });

  it('piirab deterministlikult 20 issuerini ja on korduslugemisel idempotentne', async () => {
    for (let index = 1; index <= 22; index += 1) {
      await insertSignal({ ticker: `I${String(index).padStart(2, '0')}`, sequence: index, notional: 50_000 + index });
    }
    await insertSignal({
      ticker: 'PCF', sequence: 23, notional: 1_000_000,
      issuerName: 'HIGH INCOME SECURITIES FUND',
    });
    const first = await selectNotableInsiderIssuers('2026-08-21');
    const second = await selectNotableInsiderIssuers('2026-08-21');
    expect(first).toEqual(second);
    expect(first.eligibleIssuerCount).toBe(22);
    expect(first.selectedIssuers).toHaveLength(INSIDER_LOOKUP_LIMIT);
    expect(first.selectedIssuers[0]).toMatchObject({ ticker: 'I22', insiderRank: 1 });
    expect(first.selectedIssuers.at(-1)).toMatchObject({ ticker: 'I03', insiderRank: 20 });
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM insider_filings) AS filings,
      (SELECT count(*)::int FROM insider_transactions) AS transactions`);
    expect(counts.rows[0]).toEqual({ filings: 23, transactions: 23 });
  });

  it('avaldab sourceFiledDate vanuse ja ei vali üle viie päeva vanast on-demand allikast', async () => {
    await insertSignal({ ticker: 'STALE', sequence: 1, filedDate: '2026-08-17' });
    const freshBoundary = await selectNotableInsiderIssuers('2026-08-22');
    expect(freshBoundary).toMatchObject({ sourceFiledDate: '2026-08-17', sourceAgeDays: 5, stale: false });
    expect(freshBoundary.selectedIssuers).toHaveLength(1);

    const stale = await selectNotableInsiderIssuers('2026-08-23');
    expect(stale).toMatchObject({
      policyVersion: INSIDER_SELECTION_POLICY_VERSION,
      sourceFiledDate: '2026-08-17', sourceAgeDays: 6, stale: true,
      eligibleIssuerCount: 0, selectedIssuers: [],
    });
  });
});
