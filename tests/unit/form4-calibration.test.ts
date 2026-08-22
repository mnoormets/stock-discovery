import { describe, expect, it } from 'vitest';

const {
  distribution,
  evenlySpacedSample,
} = await import('../../scripts/calibrate-form4.cjs');
const {
  datesFromQuarterListing,
  extractOwnershipXml,
  parseFormIndex,
  parseOwnershipSubmission,
  parseOwnershipXml,
} = await import('../../scripts/_form4.cjs');

const XML = `
<ownershipDocument>
  <schemaVersion>X0609</schemaVersion>
  <documentType>4</documentType>
  <periodOfReport>2026-08-20</periodOfReport>
  <dateOfOriginalSubmission>2026-08-19</dateOfOriginalSubmission>
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
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0002222222</rptOwnerCik><rptOwnerName>OWNER TWO</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>0</isDirector><isOfficer>0</isOfficer><isTenPercentOwner>1</isTenPercentOwner><isOther>0</isOther>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-08-20</value></transactionDate>
      <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>P</transactionCode><aff10b5One>1</aff10b5One></transactionCoding>
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
  <derivativeTable>
    <derivativeTransaction>
      <securityTitle><value>Option</value></securityTitle>
      <conversionOrExercisePrice><value>10.50</value></conversionOrExercisePrice>
      <transactionDate><value>2026-08-20</value></transactionDate>
      <transactionCoding><transactionCode>M</transactionCode><aff10b5One>0</aff10b5One></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>250</value></transactionShares>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <exerciseDate><value>2026-08-20</value></exerciseDate>
      <expirationDate><value>2030-08-20</value></expirationDate>
      <underlyingSecurity>
        <underlyingSecurityTitle><value>Common Stock</value><footnoteId id="F2"/></underlyingSecurityTitle>
        <underlyingSecurityShares><value>250</value></underlyingSecurityShares>
      </underlyingSecurity>
    </derivativeTransaction>
  </derivativeTable>
  <footnotes>
    <footnote id="F1">Weighted average &amp; range.</footnote>
    <footnote id="F2">One-for-one conversion.</footnote>
  </footnotes>
</ownershipDocument>`;

describe('Form 4 calibration parser', () => {
  it('parses real daily form-index columns and only Form 4/4A rows', () => {
    const rows = parseFormIndex(`Header\n4                EXAMPLE CORP                                                  910638      20260821    edgar/data/910638/0001628280-26-058429.txt\n4/A              OTHER CO                                                      1234        20260821    edgar/data/1234/0000001234-26-000001.txt\n8-K              IGNORE CO                                                     9999        20260821    edgar/data/9999/ignore.txt`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      form: '4', companyName: 'EXAMPLE CORP', cik: '910638', filedDate: '2026-08-21',
      accessionNumber: '0001628280-26-058429',
    });
    expect(rows[1].form).toBe('4/A');
  });

  it('extracts ownership XML from a complete submission', () => {
    expect(extractOwnershipXml(`<SEC-DOCUMENT>before${XML}after</SEC-DOCUMENT>`)).toContain('<schemaVersion>X0609</schemaVersion>');
    expect(extractOwnershipXml('no ownership xml')).toBeNull();
  });

  it('parses issuer, roles, qualifying fields, footnotes, and notional', () => {
    const parsed = parseOwnershipXml(XML);
    expect(parsed).toMatchObject({ schemaVersion: 'X0609', documentType: '4', periodOfReport: '2026-08-20',
      dateOfOriginalSubmission: '2026-08-19', issuerCik: '910638', issuerName: 'Example & Co', issuerTicker: 'EXM' });
    expect(parsed.owners[0]).toMatchObject({ director: true, officer: true, tenPercentOwner: false, officerTitle: 'CEO' });
    expect(parsed.owners[1]).toMatchObject({ director: false, officer: false, tenPercentOwner: true });
    expect(parsed.transactions[0]).toMatchObject({
      rowKey: 'non_derivative:0000', securityKind: 'non_derivative', code: 'P', acquiredDisposed: 'A',
      shares: 5000, price: 42.1, notional: 210500, rule10b5One: true,
    });
    expect(parsed.transactions[0].priceFootnoteIds).toEqual(['F1']);
    expect(parsed.transactions[0].priceFootnotes).toEqual(['Weighted average & range.']);
    expect(parsed.transactions[1].price).toBeNull();
    expect(parsed.transactions[1].rule10b5One).toBeNull();
    expect(parsed.transactions[2]).toMatchObject({
      rowKey: 'derivative:0000', securityKind: 'derivative', securityTitle: 'Option',
      code: 'M', conversionOrExercisePrice: 10.5, exerciseDate: '2026-08-20',
      expirationDate: '2030-08-20', underlyingSecurityTitle: 'Common Stock',
      underlyingSecurityShares: 250, rule10b5One: false, notional: null,
    });
    expect(parsed.transactions[2].footnotes).toContainEqual({
      fieldName: 'underlying_security_title', id: 'F2', text: 'One-for-one conversion.',
    });
  });

  it('parses complete-submission provenance and hashes the exact ownership XML', () => {
    const indexRow = parseFormIndex(`4                EXAMPLE CORP                                                  910638      20260821    edgar/data/910638/0001628280-26-058429.txt`)[0];
    const parsed = parseOwnershipSubmission(
      `<SEC-HEADER><ACCEPTANCE-DATETIME>20260821153045</SEC-HEADER><DOCUMENT><TYPE>4\n<FILENAME>ownership.xml\n<TEXT>${XML}</TEXT></DOCUMENT>`,
      indexRow,
    );
    expect(parsed).toMatchObject({
      accessionNumber: '0001628280-26-058429', acceptedAt: '2026-08-21 15:30:45',
      primaryDocumentFilename: 'ownership.xml', parserVersion: 'form4-ownership-v1',
    });
    expect(parsed.primaryDocumentUrl).toContain('/000162828026058429/ownership.xml');
    expect(parsed.ownershipXmlSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('extracts only actual form-index dates from a quarter listing', () => {
    expect(datesFromQuarterListing({ directory: { item: [
      { name: 'form.20260821.idx' }, { name: 'master.20260821.idx' }, { name: 'form.20260820.idx' },
    ] } })).toEqual(['2026-08-20', '2026-08-21']);
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
