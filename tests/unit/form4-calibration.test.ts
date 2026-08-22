import { describe, expect, it } from 'vitest';

const {
  distribution,
  evenlySpacedSample,
  extractOwnershipXml,
  parseFormIndex,
  parseOwnershipXml,
} = await import('../../scripts/calibrate-form4.cjs');

const XML = `
<ownershipDocument>
  <schemaVersion>X0609</schemaVersion>
  <documentType>4</documentType>
  <periodOfReport>2026-08-20</periodOfReport>
  <issuer>
    <issuerCik>0000910638</issuerCik>
    <issuerName>Example &amp; Co</issuerName>
    <issuerTradingSymbol>EXM</issuerTradingSymbol>
    <issuerForeignTradingSymbol></issuerForeignTradingSymbol>
  </issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0001251036</rptOwnerCik><rptOwnerName>OWNER ONE</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>1</isDirector><isOfficer>true</isOfficer><isTenPercentOwner>0</isTenPercentOwner><isOther>0</isOther>
      <officerTitle>CEO</officerTitle>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-08-20</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>5,000</value></transactionShares>
        <transactionPricePerShare><value>42.10</value><footnoteId id="F1"/></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>A</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>100</value></transactionShares>
        <transactionPricePerShare></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
  <footnotes><footnote id="F1">Weighted average &amp; range.</footnote></footnotes>
</ownershipDocument>`;

describe('Form 4 calibration parser', () => {
  it('parses real daily form-index columns and only Form 4/4A rows', () => {
    const rows = parseFormIndex(`Header\n4                EXAMPLE CORP                                                  910638      20260821    edgar/data/910638/0001628280-26-058429.txt\n4/A              OTHER CO                                                      1234        20260821    edgar/data/1234/0000001234-26-000001.txt\n8-K              IGNORE CO                                                     9999        20260821    edgar/data/9999/ignore.txt`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ form: '4', companyName: 'EXAMPLE CORP', cik: '910638', filedDate: '2026-08-21' });
    expect(rows[1].form).toBe('4/A');
  });

  it('extracts ownership XML from a complete submission', () => {
    expect(extractOwnershipXml(`<SEC-DOCUMENT>before${XML}after</SEC-DOCUMENT>`)).toContain('<schemaVersion>X0609</schemaVersion>');
    expect(extractOwnershipXml('no ownership xml')).toBeNull();
  });

  it('parses issuer, roles, qualifying fields, footnotes, and notional', () => {
    const parsed = parseOwnershipXml(XML);
    expect(parsed).toMatchObject({
      schemaVersion: 'X0609', documentType: '4', issuerCik: '910638', issuerName: 'Example & Co', issuerTicker: 'EXM',
    });
    expect(parsed.owners[0]).toMatchObject({ director: true, officer: true, tenPercentOwner: false, officerTitle: 'CEO' });
    expect(parsed.transactions[0]).toMatchObject({ code: 'P', acquiredDisposed: 'A', shares: 5000, price: 42.1, notional: 210500 });
    expect(parsed.transactions[0].priceFootnoteIds).toEqual(['F1']);
    expect(parsed.transactions[0].priceFootnotes).toEqual(['Weighted average & range.']);
    expect(parsed.transactions[1].price).toBeNull();
  });

  it('samples deterministically across the full ordered population', () => {
    expect(evenlySpacedSample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([1, 3, 6, 8]);
    expect(evenlySpacedSample([1, 2], Infinity)).toEqual([1, 2]);
  });

  it('uses interpolated percentiles without inventing values for an empty sample', () => {
    expect(distribution([10, 20, 30, null, Number.NaN])).toMatchObject({ n: 3, min: 10, median: 20, max: 30 });
    expect(distribution([])).toMatchObject({ n: 0, median: null });
  });
});
