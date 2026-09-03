import {
  derivePaperBusinessState,
  derivePaperMarketSetupState,
} from '@/lib/paper-strategy';
import type { CandidatePriceContext } from '@/lib/price-context';

interface CandidateSituationSummaryProps {
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  priceContext: CandidatePriceContext;
}

function score(value: number | null): string {
  return value == null ? 'unknown' : `${value}/100`;
}

export default function CandidateSituationSummary({
  growthScore,
  healthScore,
  coverageScore,
  priceContext,
}: CandidateSituationSummaryProps) {
  const business = derivePaperBusinessState({ growthScore, healthScore, coverageScore });
  const market = derivePaperMarketSetupState(priceContext);
  const marketDetail = market === 'overheated'
    ? priceContext.recentRunUpReasons.join(' · ')
    : market === 'unknown'
      ? 'Stored price history is insufficient; the setup is not inferred.'
      : 'No configured 1-, 3-, or 6-month run-up threshold is breached.';

  return <section className="todaySituationSummary" aria-label="Business and market situation">
    <div className="todaySituationAxis">
      <span>Business</span>
      <strong className={business === 'strong' ? 'positive' : 'negative'}>
        {business === 'strong' ? 'Strong' : 'Mixed'}
      </strong>
      <small>Growth {score(growthScore)} · Health {score(healthScore)} · Coverage {score(coverageScore)}</small>
    </div>
    <div className="todaySituationAxis">
      <span>Market setup</span>
      <strong className={market === 'not_overheated' ? 'positive' : market === 'overheated' ? 'negative' : 'scoreNeutral'}>
        {market === 'not_overheated' ? 'Not overheated' : market === 'overheated' ? 'Run-up elevated' : 'Unknown'}
      </strong>
      <small>{marketDetail}</small>
    </div>
    <p>Independent research checks, not a buy signal. Open the evidence below before acting.</p>
  </section>;
}
