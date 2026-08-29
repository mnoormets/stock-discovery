import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Form4PurchaseEvidence, {
  LEGACY_INSIDER_EVIDENCE_MESSAGE,
} from '../../src/components/Form4PurchaseEvidence';
import type { TodayInsiderEvidence } from '../../src/lib/today-insider-evidence';

const completeEvidence: TodayInsiderEvidence = {
  state: 'complete',
  evidenceVersion: 'form4-card-evidence-v1',
  policyVersion: 'form4-insider-selection-v1',
  sourceFiledDate: '2026-08-15',
  transactions: [{
    transactionId: '1',
    accessionNumber: '0000000000-26-000001',
    formType: '4',
    filedDate: '2026-08-15',
    transactionDate: '2026-08-14',
    securityTitle: 'Common Stock',
    shares: '5000.1250',
    reportedPricePerShare: '42.1000',
    derivedNotional: '210505.26250000',
    derivedNotionalMethod: 'transaction_shares_x_transaction_price_per_share',
    filingUrl: 'https://www.sec.gov/Archives/filing.xml',
    rule10b51: false,
    owners: [{
      ownerName: 'Alex Example', ownerCik: '0000000001',
      isDirector: true, isOfficer: true, isTenPercentOwner: true,
      isOther: true, hasNoDeclaredRole: false,
      officerTitle: 'Chief Financial Officer', otherText: 'Trustee',
    }],
  }],
};

describe('Form 4 purchase evidence', () => {
  it('renders raw transaction facts, safe SEC link, and every owner role label', () => {
    const html = renderToStaticMarkup(createElement(Form4PurchaseEvidence, { evidence: completeEvidence }));

    expect(html).toContain('SEC Form 4 purchase evidence');
    expect(html).toContain('form4-card-evidence-v1');
    expect(html).toContain('Reporting owner(s)');
    expect(html).toContain('Alex Example');
    expect(html).toContain('Director');
    expect(html).toContain('Officer — Chief Financial Officer');
    expect(html).toContain('10% owner');
    expect(html).toContain('Other — Trustee');
    expect(html).toContain('5000.1250');
    expect(html).toContain('42.1000');
    expect(html).toContain('210505.26250000');
    expect(html).not.toContain('$');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('This is not a daily-completeness claim.');
  });

  it('renders missing numeric facts as unknown, never zero or inferred currency', () => {
    const evidence = structuredClone(completeEvidence) as Extract<TodayInsiderEvidence, { state: 'complete' }>;
    evidence.transactions[0].shares = null;
    evidence.transactions[0].reportedPricePerShare = null;
    evidence.transactions[0].derivedNotional = null;
    evidence.transactions[0].derivedNotionalMethod = null;
    const html = renderToStaticMarkup(createElement(Form4PurchaseEvidence, { evidence }));

    expect((html.match(/unknown/g) || [])).toHaveLength(3);
    expect(html).not.toContain('$');
    expect(html).not.toContain('>0<');
  });

  it('renders the approved honest historical message for legacy evidence', () => {
    const html = renderToStaticMarkup(createElement(Form4PurchaseEvidence, { evidence: {
      state: 'legacy', evidenceVersion: null, policyVersion: 'form4-insider-selection-v1',
      sourceFiledDate: '2026-08-15', transactions: [],
    } }));
    expect(html).toContain(LEGACY_INSIDER_EVIDENCE_MESSAGE);
    expect(html).not.toContain('Open SEC filing');
  });

  it('fails closed to the same honest message for malformed evidence', () => {
    const html = renderToStaticMarkup(createElement(Form4PurchaseEvidence, { evidence: {
      state: 'malformed', evidenceVersion: 'form4-card-evidence-v1', policyVersion: null,
      sourceFiledDate: null, transactions: [],
    } }));
    expect(html).toContain(LEGACY_INSIDER_EVIDENCE_MESSAGE);
  });
});
