import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  INSIDER_CARD_EVIDENCE_VERSION,
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
  shares?: string;
  price?: string;
  primaryDocumentUrl?: string;
  owners?: Array<{
    cik: string;
    name: string;
    director?: boolean;
    officer?: boolean;
    tenPercentOwner?: boolean;
    other?: boolean;
    officerTitle?: string;
    otherText?: string;
  }>;
}

async function insertSignal(options: SignalOptions): Promise<void> {
  const filedDate = options.filedDate || '2026-08-21';
  const formType = options.formType || '4';
  const director = options.director ?? true;
  const officer = options.officer ?? false;
  const tenPercentOwner = options.tenPercentOwner ?? false;
  const owners = options.owners || [{
    cik: String(9000 + options.sequence), name: `Owner ${options.sequence}`,
    director, officer, tenPercentOwner,
  }];
  const filingHasDirector = owners.some((owner) => owner.director === true);
  const filingHasOfficer = owners.some((owner) => owner.officer === true);
  const filingHasTenPercentOwner = owners.some((owner) => owner.tenPercentOwner === true);
  const filingHasOther = owners.some((owner) => owner.other === true);
  const filingHasNoRole = owners.some((owner) => !owner.director && !owner.officer && !owner.tenPercentOwner && !owner.other);
  const accession = `0000000001-26-${String(options.sequence).padStart(6, '0')}`;
  const filing = await pool.query(
    `INSERT INTO insider_filings (
       accession_number, form_type, issuer_cik, issuer_ticker, issuer_name,
       filed_date, accepted_at, sec_submission_url, sec_primary_document_url, parser_version,
       ownership_xml_sha256, amendment_link_status, ingestion_status,
       ingestion_attempt_count, ingested_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'form4-xml-v1',$10,$11,'persisted',1,$7)
     RETURNING id`,
    [accession, formType, String(1000 + options.sequence), options.ticker,
      options.issuerName || `${options.ticker} Corp`, filedDate, `${filedDate}T12:00:00.000Z`,
      `https://www.sec.gov/Archives/${accession}`, options.primaryDocumentUrl || null, 'a'.repeat(64),
      formType === '4' ? 'not_applicable' : 'unresolved'],
  );
  const filingId = Number(filing.rows[0].id);
  for (const [index, owner] of owners.entries()) {
    await pool.query(
      `INSERT INTO insider_reporting_owners (
         filing_id, owner_row_key, owner_cik, owner_name, is_director, is_officer,
         is_ten_percent_owner, is_other, officer_title, other_text
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [filingId, `owner:${index + 1}`, owner.cik, owner.name,
        owner.director || false, owner.officer || false, owner.tenPercentOwner || false,
        owner.other || false, owner.officerTitle || null, owner.otherText || null],
    );
  }
  const notional = options.notional ?? 75_000;
  const shares = options.shares || String(notional);
  const price = options.price || '1';
  await pool.query(
    `INSERT INTO insider_transactions (
       filing_id, transaction_row_key, security_kind, transaction_date,
       security_title, transaction_code, acquired_disposed_code,
       transaction_shares, transaction_price_per_share,
       reporting_owner_count, filing_has_director_owner, filing_has_officer_owner,
       filing_has_ten_percent_owner, filing_has_other_owner,
       filing_has_owner_without_declared_role
     ) VALUES ($1,'transaction:1',$2,$3,'Common Stock',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [filingId, options.securityKind || 'non_derivative', filedDate,
      options.transactionCode || 'P', options.acquiredDisposedCode || 'A', shares, price,
      owners.length, filingHasDirector, filingHasOfficer, filingHasTenPercentOwner,
      filingHasOther, filingHasNoRole],
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

  it('ignores a newer source date until every registered accession is persisted', async () => {
    await insertSignal({ ticker: 'COMPLETE', sequence: 40, filedDate: '2026-08-20' });
    await insertSignal({ ticker: 'PARTIAL', sequence: 41, filedDate: '2026-08-21' });
    await pool.query(
      `INSERT INTO insider_filings (
         accession_number, form_type, issuer_cik, issuer_name, filed_date,
         sec_submission_url, amendment_link_status, ingestion_status,
         ingestion_attempt_count, last_attempted_at
       ) VALUES ('0000000001-26-999999','4','999999','Pending Corp','2026-08-21',
                 'https://www.sec.gov/Archives/pending','not_applicable','discovered',1,now())`,
    );

    const selection = await selectNotableInsiderIssuers('2026-08-21');
    expect(selection).toMatchObject({ sourceFiledDate: '2026-08-20', sourceAgeDays: 1, stale: false });
    expect(selection.selectedIssuers.map((issuer) => issuer.ticker)).toEqual(['COMPLETE']);
  });

  it('freezes lossless decimal facts, filing provenance, and every reporting-owner role', async () => {
    await insertSignal({
      ticker: 'PRECISE', sequence: 30,
      shares: '9007199254740993.125', price: '2.5',
      primaryDocumentUrl: 'https://www.sec.gov/Archives/primary.xml',
      owners: [
        {
          cik: '1111111', name: 'Multi Role Owner', director: true, officer: true,
          tenPercentOwner: true, officerTitle: 'Chief Financial Officer',
        },
        { cik: '2222222', name: 'Other Owner', other: true, otherText: 'Trustee' },
        { cik: '3333333', name: 'No Declared Role' },
      ],
    });

    const selection = await selectNotableInsiderIssuers('2026-08-21');
    const transaction = selection.selectedIssuers[0].transactions[0];
    expect(INSIDER_CARD_EVIDENCE_VERSION).toBe('form4-card-evidence-v1');
    expect(transaction).toMatchObject({
      formType: '4', filedDate: '2026-08-21', transactionDate: '2026-08-21',
      securityTitle: 'Common Stock',
      shares: '9007199254740993.125',
      reportedPricePerShare: '2.5',
      derivedNotional: '22517998136852482.8125',
      derivedNotionalMethod: 'transaction_shares_x_transaction_price_per_share',
      filingUrl: 'https://www.sec.gov/Archives/primary.xml',
    });
    expect(transaction.owners).toEqual([
      {
        ownerName: 'Multi Role Owner', ownerCik: '1111111', isDirector: true,
        isOfficer: true, isTenPercentOwner: true, isOther: false,
        hasNoDeclaredRole: false, officerTitle: 'Chief Financial Officer', otherText: null,
      },
      {
        ownerName: 'Other Owner', ownerCik: '2222222', isDirector: false,
        isOfficer: false, isTenPercentOwner: false, isOther: true,
        hasNoDeclaredRole: false, officerTitle: null, otherText: 'Trustee',
      },
      {
        ownerName: 'No Declared Role', ownerCik: '3333333', isDirector: false,
        isOfficer: false, isTenPercentOwner: false, isOther: false,
        hasNoDeclaredRole: true, officerTitle: null, otherText: null,
      },
    ]);
  });
});
