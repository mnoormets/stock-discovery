import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { resetDb } from '../setup/reset';

const { parseOwnershipSubmission } = await import('../../scripts/_form4.cjs');
const {
  persistForm4Filing,
  recordFilingAttempt,
} = await import('../../scripts/_form4-persistence.cjs');

beforeEach(resetDb);

interface OwnerInput {
  cik: string;
  name: string;
  director?: boolean;
  officer?: boolean;
  tenPercentOwner?: boolean;
  other?: boolean;
  title?: string;
}

function indexRow(accessionNumber: string, form = '4', filedDate = '2026-08-20') {
  const cik = '910638';
  return {
    form,
    companyName: 'Example Corp',
    cik,
    filedDate,
    accessionNumber,
    archivePath: `edgar/data/${cik}/${accessionNumber}.txt`,
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}.txt`,
  };
}

function ownerXml(owner: OwnerInput) {
  return `<reportingOwner>
    <reportingOwnerId><rptOwnerCik>${owner.cik}</rptOwnerCik><rptOwnerName>${owner.name}</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>${owner.director ? 1 : 0}</isDirector>
      <isOfficer>${owner.officer ? 1 : 0}</isOfficer>
      <isTenPercentOwner>${owner.tenPercentOwner ? 1 : 0}</isTenPercentOwner>
      <isOther>${owner.other ? 1 : 0}</isOther>
      ${owner.title ? `<officerTitle>${owner.title}</officerTitle>` : ''}
    </reportingOwnerRelationship>
  </reportingOwner>`;
}

function parsedFiling(
  row: ReturnType<typeof indexRow>,
  owners: OwnerInput[] = [{ cik: '1251036', name: 'Owner One', director: true }],
  originalSubmissionDate?: string,
) {
  const xml = `<ownershipDocument>
    <schemaVersion>X0609</schemaVersion>
    <documentType>${row.form}</documentType>
    <periodOfReport>2026-08-20</periodOfReport>
    ${originalSubmissionDate ? `<dateOfOriginalSubmission>${originalSubmissionDate}</dateOfOriginalSubmission>` : ''}
    <issuer><issuerCik>0000910638</issuerCik><issuerName>Example Corp</issuerName><issuerTradingSymbol>EXM</issuerTradingSymbol></issuer>
    ${owners.map(ownerXml).join('')}
    <nonDerivativeTable><nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-08-20</value></transactionDate>
      <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>P</transactionCode><aff10b5One>1</aff10b5One></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>5000</value></transactionShares>
        <transactionPricePerShare><value>42.10</value><footnoteId id="F1"/></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts><sharesOwnedFollowingTransaction><value>9000</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
      <ownershipNature><directOrIndirectOwnership><value>D</value></directOrIndirectOwnership></ownershipNature>
    </nonDerivativeTransaction></nonDerivativeTable>
    <footnotes><footnote id="F1">Weighted average price.</footnote></footnotes>
  </ownershipDocument>`;
  return parseOwnershipSubmission(
    `<SEC-HEADER><ACCEPTANCE-DATETIME>20260820120000</SEC-HEADER><DOCUMENT><TYPE>${row.form}\n<FILENAME>form4.xml\n<TEXT>${xml}</TEXT></DOCUMENT>`,
    row,
  );
}

async function counts() {
  const { rows } = await pool.query(`SELECT
    (SELECT count(*)::int FROM insider_filings) AS filings,
    (SELECT count(*)::int FROM insider_reporting_owners) AS owners,
    (SELECT count(*)::int FROM insider_transactions) AS transactions,
    (SELECT count(*)::int FROM insider_transaction_footnotes) AS footnotes`);
  return rows[0];
}

describe('SEC Form 4 persistence', () => {
  it('is idempotent by accession without changing children or persisted time', async () => {
    const row = indexRow('0000000001-26-000001');
    const parsed = parsedFiling(row);
    const first = await persistForm4Filing(pool, row, parsed);
    const before = await pool.query(`SELECT ingested_at, updated_at FROM insider_filings WHERE id = $1`, [first.filingId]);
    const second = await persistForm4Filing(pool, row, parsed);
    const after = await pool.query(`SELECT ingested_at, updated_at FROM insider_filings WHERE id = $1`, [first.filingId]);

    expect(second).toMatchObject({ filingId: first.filingId, created: false, skipped: true });
    expect(await counts()).toEqual({ filings: 1, owners: 1, transactions: 1, footnotes: 1 });
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('links an amendment ingested after its original without overwriting either filing', async () => {
    const original = indexRow('0000000002-26-000001', '4', '2026-08-20');
    const amendment = indexRow('0000000002-26-000002', '4/A', '2026-08-21');
    const originalResult = await persistForm4Filing(pool, original, parsedFiling(original));
    const amendmentResult = await persistForm4Filing(pool, amendment, parsedFiling(amendment, undefined, '2026-08-20'));
    const { rows } = await pool.query(`SELECT accession_number, form_type, amends_filing_id, amendment_link_status
      FROM insider_filings ORDER BY accession_number`);

    expect(rows).toHaveLength(2);
    expect(rows.find((item) => item.form_type === '4/A')).toMatchObject({
      amends_filing_id: String(originalResult.filingId), amendment_link_status: 'resolved',
    });
    expect(amendmentResult.amendmentLinks.resolved).toBe(1);
  });

  it('resolves an amendment after the original arrives later', async () => {
    const original = indexRow('0000000003-26-000001', '4', '2026-08-20');
    const amendment = indexRow('0000000003-26-000002', '4/A', '2026-08-21');
    const amendmentResult = await persistForm4Filing(pool, amendment, parsedFiling(amendment, undefined, '2026-08-20'));
    let link = await pool.query(`SELECT amends_filing_id, amendment_link_status FROM insider_filings WHERE id = $1`, [amendmentResult.filingId]);
    expect(link.rows[0]).toMatchObject({ amends_filing_id: null, amendment_link_status: 'unresolved' });

    const originalResult = await persistForm4Filing(pool, original, parsedFiling(original));
    link = await pool.query(`SELECT amends_filing_id, amendment_link_status FROM insider_filings WHERE id = $1`, [amendmentResult.filingId]);
    expect(link.rows[0]).toMatchObject({ amends_filing_id: String(originalResult.filingId), amendment_link_status: 'resolved' });
  });

  it('preserves 10%-owner and multi-label director/officer roles on every transaction', async () => {
    const row = indexRow('0000000004-26-000001');
    await persistForm4Filing(pool, row, parsedFiling(row, [
      { cik: '1111111', name: 'Fund Owner', tenPercentOwner: true },
      { cik: '2222222', name: 'Chief Owner', director: true, officer: true, title: 'CEO' },
    ]));
    const transaction = await pool.query(`SELECT reporting_owner_count, filing_has_director_owner,
      filing_has_officer_owner, filing_has_ten_percent_owner, filing_has_other_owner,
      derived_notional, derived_notional_method, rule_10b5_1 FROM insider_transactions`);
    expect(transaction.rows[0]).toMatchObject({
      reporting_owner_count: 2,
      filing_has_director_owner: true,
      filing_has_officer_owner: true,
      filing_has_ten_percent_owner: true,
      filing_has_other_owner: false,
      derived_notional_method: 'transaction_shares_x_transaction_price_per_share',
      rule_10b5_1: true,
    });
    expect(Number(transaction.rows[0].derived_notional)).toBe(210500);
    const evidence = await pool.query(`SELECT owner_name, is_director, is_officer, is_ten_percent_owner
      FROM insider_transaction_owner_evidence ORDER BY owner_name`);
    expect(evidence.rows).toEqual([
      expect.objectContaining({ owner_name: 'Chief Owner', is_director: true, is_officer: true, is_ten_percent_owner: false }),
      expect.objectContaining({ owner_name: 'Fund Owner', is_director: false, is_officer: false, is_ten_percent_owner: true }),
    ]);
  });

  it('rolls back all parsed content when a transaction insert fails after owners were inserted', async () => {
    const row = indexRow('0000000005-26-000001');
    await recordFilingAttempt(pool, row);
    const parsed = parsedFiling(row);
    parsed.transactions[0].acquiredDisposed = 'X';
    await expect(persistForm4Filing(pool, row, parsed)).rejects.toMatchObject({ code: '23514' });
    expect(await counts()).toEqual({ filings: 1, owners: 0, transactions: 0, footnotes: 0 });
    const stub = await pool.query(`SELECT ingestion_status, parser_version, ownership_xml_sha256 FROM insider_filings`);
    expect(stub.rows[0]).toEqual({ ingestion_status: 'discovered', parser_version: null, ownership_xml_sha256: null });
  });

  it('rejects transaction role context that disagrees with normalized owner rows', async () => {
    const row = indexRow('0000000006-26-000001');
    const saved = await persistForm4Filing(pool, row, parsedFiling(row));
    await expect(pool.query(
      `INSERT INTO insider_transactions (
         filing_id, transaction_row_key, security_kind, reporting_owner_count,
         filing_has_director_owner, filing_has_officer_owner,
         filing_has_ten_percent_owner, filing_has_other_owner,
         filing_has_owner_without_declared_role
       ) VALUES ($1,'invalid-role-context','non_derivative',1,false,false,false,false,true)`,
      [saved.filingId],
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('does not write companies, collection, discovery, score, ranking, or candidate tables', async () => {
    const protectedCounts = () => pool.query(`SELECT
      (SELECT count(*)::int FROM companies) AS companies,
      (SELECT count(*)::int FROM collection_runs) AS collection_runs,
      (SELECT count(*)::int FROM collection_run_items) AS collection_run_items,
      (SELECT count(*)::int FROM discovery_runs) AS discovery_runs,
      (SELECT count(*)::int FROM discovery_decisions) AS discovery_decisions,
      (SELECT count(*)::int FROM company_score_snapshots) AS company_score_snapshots,
      (SELECT count(*)::int FROM candidate_outcomes) AS candidate_outcomes,
      (SELECT count(*)::int FROM snapshots) AS snapshots`);
    const before = await protectedCounts();
    const row = indexRow('0000000007-26-000001');
    await persistForm4Filing(pool, row, parsedFiling(row));
    const after = await protectedCounts();
    expect(after.rows).toEqual(before.rows);
    expect(Object.values(after.rows[0])).toEqual(Array(8).fill(0));
  });
});
