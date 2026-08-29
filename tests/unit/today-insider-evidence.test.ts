import { describe, expect, it } from 'vitest';
import { parseTodayInsiderEvidence } from '../../src/lib/today-insider-evidence';

const completePayload = {
  insider: {
    evidenceVersion: 'form4-card-evidence-v1',
    policyVersion: 'form4-insider-selection-v1',
    sourceFiledDate: '2026-08-15',
    transactions: [{
      transactionId: '1',
      accessionNumber: '0000000000-26-000001',
      formType: '4',
      filedDate: '2026-08-15',
      transactionDate: null,
      securityTitle: null,
      shares: null,
      reportedPricePerShare: null,
      derivedNotional: null,
      derivedNotionalMethod: null,
      filingUrl: 'https://www.sec.gov/Archives/filing.xml',
      rule10b51: null,
      owners: [{
        ownerName: 'Owner Name', ownerCik: null,
        isDirector: true, isOfficer: false, isTenPercentOwner: false,
        isOther: false, hasNoDeclaredRole: false,
        officerTitle: null, otherText: null,
      }],
    }],
  },
};

describe('Today insider evidence parser', () => {
  it('accepts the complete v1 contract without converting decimal strings', () => {
    const parsed = parseTodayInsiderEvidence(completePayload);
    expect(parsed).toMatchObject({ state: 'complete', transactions: [{ shares: null }] });
  });

  it('returns null when no insider snapshot exists', () => {
    expect(parseTodayInsiderEvidence({ apeWisdom: {} })).toBeNull();
  });

  it('marks pre-version snapshots as legacy without exposing partial transactions', () => {
    expect(parseTodayInsiderEvidence({ insider: { transactions: [{ derivedNotional: 50001 }] } }))
      .toEqual({ state: 'legacy', evidenceVersion: null, policyVersion: null, sourceFiledDate: null, transactions: [] });
  });

  it('fails closed when a v1 decimal is a JavaScript number', () => {
    const malformed: any = structuredClone(completePayload);
    malformed.insider.transactions[0].shares = 10;
    expect(parseTodayInsiderEvidence(malformed)).toMatchObject({ state: 'malformed', transactions: [] });
  });

  it('fails closed when role flags or the SEC filing URL are incomplete', () => {
    const malformed = structuredClone(completePayload) as any;
    delete malformed.insider.transactions[0].owners[0].isTenPercentOwner;
    malformed.insider.transactions[0].filingUrl = 'https://example.com/filing.xml';
    expect(parseTodayInsiderEvidence(malformed)).toMatchObject({ state: 'malformed', transactions: [] });
  });

  it('fails closed for invalid dates and an unrecognized derivation method', () => {
    const malformed: any = structuredClone(completePayload);
    malformed.insider.transactions[0].transactionDate = 'not-a-date';
    malformed.insider.transactions[0].derivedNotional = '10';
    malformed.insider.transactions[0].derivedNotionalMethod = 'estimated';
    expect(parseTodayInsiderEvidence(malformed)).toMatchObject({ state: 'malformed', transactions: [] });
  });
});
