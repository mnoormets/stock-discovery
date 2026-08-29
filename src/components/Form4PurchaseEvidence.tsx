import type {
  TodayInsiderEvidence,
  TodayInsiderOwner,
} from '@/lib/today-insider-evidence';

export const LEGACY_INSIDER_EVIDENCE_MESSAGE = 'Detailed owner/share/price evidence was not captured for this historical collection item.';

function fact(value: string | null): string {
  return value == null || value === '' ? 'unknown' : value;
}

export function reportingOwnerRoleLabels(owner: TodayInsiderOwner): string[] {
  const labels: string[] = [];
  if (owner.isDirector) labels.push('Director');
  if (owner.isOfficer) labels.push(owner.officerTitle ? `Officer — ${owner.officerTitle}` : 'Officer');
  if (owner.isTenPercentOwner) labels.push('10% owner');
  if (owner.isOther) labels.push(owner.otherText ? `Other — ${owner.otherText}` : 'Other');
  if (owner.hasNoDeclaredRole) labels.push('No declared role');
  return labels;
}

export default function Form4PurchaseEvidence({ evidence }: { evidence: TodayInsiderEvidence }) {
  if (evidence.state !== 'complete') {
    return (
      <section className="todayInsiderEvidence" aria-label="SEC Form 4 purchase evidence">
        <h3>SEC Form 4 purchase evidence</h3>
        <p className="muted">{LEGACY_INSIDER_EVIDENCE_MESSAGE}</p>
      </section>
    );
  }

  return (
    <section className="todayInsiderEvidence" aria-label="SEC Form 4 purchase evidence">
      <div className="todaySubsectionHeading">
        <div><p className="eyebrow">RAW SEC FACTS</p><h3>SEC Form 4 purchase evidence</h3></div>
        <span className="todayEvidenceVersion">{evidence.evidenceVersion}</span>
      </div>
      <div className="todayInsiderTransactions">
        {evidence.transactions.map((transaction) => (
          <article key={transaction.transactionId}>
            <dl className="todayInsiderFacts">
              <div><dt>Transaction date</dt><dd>{fact(transaction.transactionDate)}</dd></div>
              <div><dt>Security</dt><dd>{fact(transaction.securityTitle)}</dd></div>
              <div><dt>Shares</dt><dd>{fact(transaction.shares)}</dd></div>
              <div><dt>Reported price/share</dt><dd>{fact(transaction.reportedPricePerShare)}</dd></div>
              <div><dt>Derived notional = shares × reported price</dt><dd>{fact(transaction.derivedNotional)}</dd></div>
            </dl>
            <div className="todayReportingOwners">
              <strong>Reporting owner(s)</strong>
              {transaction.owners.map((owner, index) => (
                <div className="todayReportingOwner" key={`${transaction.transactionId}-${owner.ownerCik || owner.ownerName}-${index}`}>
                  <span>{owner.ownerName}</span>
                  <div>{reportingOwnerRoleLabels(owner).map((label) => <b key={label}>{label}</b>)}</div>
                </div>
              ))}
            </div>
            <p className="todayInsiderFiling">
              Filed {transaction.filedDate}{' · '}
              <a href={transaction.filingUrl} target="_blank" rel="noreferrer">Open SEC filing ↗</a>
            </p>
          </article>
        ))}
      </div>
      <p className="todaySubtle">Captured from on-demand Form 4 ingestion; source filed date {evidence.sourceFiledDate}. This is not a daily-completeness claim.</p>
    </section>
  );
}
