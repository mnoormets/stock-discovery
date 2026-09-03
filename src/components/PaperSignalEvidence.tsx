import type { PaperSignalEvidence as Evidence } from '@/lib/paper-performance';

const BUSINESS_LABELS = {
  strong: 'Strong',
  mixed: 'Mixed',
  unknown: 'Unknown',
} as const;

const MARKET_LABELS = {
  not_overheated: 'Not overheated',
  overheated: 'Run-up elevated',
  unknown: 'Unknown',
} as const;

function stateClass(state: string): string {
  if (state === 'strong' || state === 'not_overheated') return 'positive';
  if (state === 'mixed' || state === 'overheated') return 'negative';
  return 'scoreNeutral';
}

export default function PaperSignalEvidence({ evidence }: { evidence: Evidence }) {
  if (evidence.state === 'unknown') {
    return <div className="paperSignalEvidence">
      <div className="paperEvidenceGrid">
        <span><small>Business</small><strong className="scoreNeutral">Unknown</strong></span>
        <span><small>Market setup</small><strong className="scoreNeutral">Unknown</strong></span>
      </div>
      <small>Immutable V1 signal evidence is unavailable for this order.</small>
    </div>;
  }

  return <div className="paperSignalEvidence">
    <div className="paperEvidenceGrid">
      <span><small>Business</small><strong className={stateClass(evidence.businessState)}>{BUSINESS_LABELS[evidence.businessState]}</strong></span>
      <span><small>Market setup</small><strong className={stateClass(evidence.marketSetupState)}>{MARKET_LABELS[evidence.marketSetupState]}</strong></span>
    </div>
    <small>{evidence.freshnessState === 'current_collection_confirmed'
      ? 'Current collection confirmed'
      : 'Current collection not confirmed'}</small>
    {evidence.reasons.length > 0 && <details className="paperEvidenceReasons">
      <summary>Why this state?</summary>
      <ul>{evidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </details>}
  </div>;
}
